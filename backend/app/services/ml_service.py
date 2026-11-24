from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, silhouette_score
from sklearn.preprocessing import StandardScaler

from app.config import settings

CLUSTER_LABELS = {
    0: "Alto Valor / VIP",
    1: "Recurrentes / Crecimiento",
    2: "En Riesgo / Reactivación",
}
EXPERT_NAMES = [
    "Experto 0 · Alto Valor",
    "Experto 1 · Recurrente",
    "Experto 2 · Reactivación",
]


class ExpertNetwork(nn.Module):
    def __init__(self, input_dim: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(input_dim, 32), nn.ReLU(), nn.Linear(32, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class GreenSightMoE(nn.Module):
    def __init__(self, input_dim: int, num_experts: int = 3):
        super().__init__()
        self.experts = nn.ModuleList([ExpertNetwork(input_dim) for _ in range(num_experts)])
        self.gate = nn.Sequential(
            nn.Linear(input_dim, 16),
            nn.ReLU(),
            nn.Linear(16, num_experts),
            nn.Softmax(dim=-1),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        gate_weights = self.gate(x)
        expert_outputs = torch.cat([expert(x) for expert in self.experts], dim=-1)
        output = torch.sum(gate_weights * expert_outputs, dim=-1, keepdim=True)
        return output, gate_weights


def _resolve_path(subpath: str) -> Path:
    candidates = [
        settings.data_dir / subpath,
        Path(__file__).resolve().parents[3] / "src" / "data" / subpath,
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]


def load_cached_insights() -> dict[str, Any] | None:
    path = _resolve_path("colab/greensight_insights.json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


async def fetch_colab_insights(custom_url: str | None = None) -> dict[str, Any] | None:
    url = (custom_url or settings.colab_insights_url).strip()
    if not url:
        return None
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


def train_and_compute_insights(fecha_referencia: str = "2026-10-31") -> dict[str, Any]:
    """Ejecuta el pipeline completo GreenSight (PCA + KMeans + GLM Tweedie + PyTorch MoE) sobre fixtures."""
    fixtures_dir = _resolve_path("fixtures")
    customers_raw = json.loads((fixtures_dir / "customers.json").read_text(encoding="utf-8"))
    sales_raw = json.loads((fixtures_dir / "sales.json").read_text(encoding="utf-8"))
    trm_raw = json.loads((fixtures_dir / "trm.json").read_text(encoding="utf-8"))

    ref_dt = pd.to_datetime(fecha_referencia)
    df_customers = pd.DataFrame(customers_raw)
    df_sales = pd.DataFrame(sales_raw)
    df_trm = pd.DataFrame(trm_raw, columns=["fecha", "cop_por_usd"]).sort_values("fecha")
    df_trm["fecha_dt"] = pd.to_datetime(df_trm["fecha"])
    df_sales["fecha_dt"] = pd.to_datetime(df_sales["fecha"])
    df_sales = pd.merge_asof(df_sales.sort_values("fecha_dt"), df_trm[["fecha_dt", "cop_por_usd"]], on="fecha_dt", direction="backward")
    df_sales["cop_por_usd"] = df_sales["cop_por_usd"].fillna(df_trm["cop_por_usd"].iloc[0])
    df_sales["valor_cop"] = np.where(
        df_sales["moneda"] == "USD",
        df_sales["cantidad"] * df_sales["precioUnitario"] * df_sales["cop_por_usd"],
        df_sales["cantidad"] * df_sales["precioUnitario"],
    )
    df_conf = df_sales[(df_sales["estado"] == "Confirmada") & (df_sales["fecha_dt"] <= ref_dt)].copy()

    rows_cust = []
    for _, c in df_customers.iterrows():
        mine = df_conf[df_conf["customerId"] == c["id"]].sort_values("fecha_dt")
        days_ago = (ref_dt - mine["fecha_dt"]).dt.days if len(mine) else pd.Series([], dtype=float)
        in12 = mine[days_ago < 365] if len(mine) else mine
        in90 = mine[days_ago < 91] if len(mine) else mine
        prev_q = mine[(days_ago >= 91) & (days_ago < 456)] if len(mine) else mine
        val_90_m = float(in90["valor_cop"].sum() / 1e6)
        val_12_m = float(in12["valor_cop"].sum() / 1e6)
        prev_q_m = float(prev_q["valor_cop"].sum() / 4.0 / 1e6)
        estac = float(np.clip((val_90_m / prev_q_m) if prev_q_m > 0 else (1.2 if val_90_m > 0 else 0.5), 0.3, 2.5))
        top_prod = mine.groupby("producto")["valor_cop"].sum().idxmax() if len(mine) else "Implementación documental"
        rows_cust.append({
            "id": c["id"],
            "empresa": c["empresa"],
            "ciudad": c["ciudad"],
            "sector": c["sector"],
            "canal": c["canal"],
            "frecuencia_compra": float(len(in12)),
            "ticket_promedio": float(mine["valor_cop"].mean() / 1e6) if len(mine) else 0.0,
            "recencia_dias": float((ref_dt - mine["fecha_dt"].max()).days) if len(mine) else 365.0,
            "variedad_categorias": float(mine["producto"].nunique()) if len(mine) else 0.0,
            "indice_estacionalidad": estac,
            "producto_recomendado": top_prod,
            "demanda_valor": (0.65 * val_90_m + 0.35 * (val_12_m / 4.0)) if len(mine) else 0.0,
        })

    df = pd.DataFrame(rows_cust)
    features = ["frecuencia_compra", "ticket_promedio", "recencia_dias", "variedad_categorias", "indice_estacionalidad"]

    torch.manual_seed(42)
    np.random.seed(42)
    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(df[features])
    pca = PCA(n_components=3, random_state=42)
    x_pca = pca.fit_transform(x_scaled)
    df[["pca_1", "pca_2", "pca_3"]] = x_pca

    kmeans = KMeans(n_clusters=3, random_state=42, n_init="auto")
    raw_clusters = kmeans.fit_predict(x_pca)
    order = pd.Series(df["demanda_valor"]).groupby(raw_clusters).mean().sort_values(ascending=False).index.tolist()
    remap = {old: new for new, old in enumerate(order)}
    df["cluster"] = [remap[c] for c in raw_clusters]
    sil_score = float(silhouette_score(x_pca, df["cluster"]))

    df["pred_glm"] = 0.0
    for cid in range(3):
        sub = df[df["cluster"] == cid]
        try:
            m = smf.glm("demanda_valor ~ pca_1 + pca_2 + pca_3 + indice_estacionalidad", data=sub, family=sm.families.Tweedie(var_power=1.5, link=sm.families.links.Log())).fit()
            df.loc[df["cluster"] == cid, "pred_glm"] = np.clip(m.predict(sub), 0.0, None)
        except Exception:
            m = smf.glm("demanda_valor ~ pca_1 + pca_2", data=sub, family=sm.families.Tweedie(var_power=1.5, link=sm.families.links.Log())).fit_regularized(alpha=0.05)
            df.loc[df["cluster"] == cid, "pred_glm"] = np.clip(m.predict(sub), 0.0, None)

    moe_scaler = StandardScaler()
    x_moe_np = moe_scaler.fit_transform(df[["pca_1", "pca_2", "pca_3", "pred_glm"]])
    y_mean, y_std = float(df["demanda_valor"].mean()), float(df["demanda_valor"].std() or 1.0)
    x_moe = torch.tensor(x_moe_np, dtype=torch.float32)
    y_moe = torch.tensor((df["demanda_valor"].values - y_mean) / y_std, dtype=torch.float32).unsqueeze(1)
    onehot = torch.nn.functional.one_hot(torch.tensor(df["cluster"].values), num_classes=3).float()

    moe = GreenSightMoE(4, 3)
    opt = optim.Adam(moe.parameters(), lr=0.02)
    crit = nn.MSELoss()
    for _ in range(350):
        opt.zero_grad()
        p, gw = moe(x_moe)
        (crit(p, y_moe) + 0.35 * crit(gw, onehot)).backward()
        opt.step()

    with torch.no_grad():
        pn, wn = moe(x_moe)
        df["pred_moe"] = np.clip(pn.squeeze().numpy() * y_std + y_mean, 0.0, None)
        w_np = wn.numpy()
        for e in range(3):
            df[f"peso_exp_{e}"] = w_np[:, e]

    mse_val = float(mean_squared_error(df["demanda_valor"], df["pred_moe"]))
    rmse_val = float(np.sqrt(mse_val))
    mae_val = float(mean_absolute_error(df["demanda_valor"], df["pred_moe"]))
    r2_val = float(r2_score(df["demanda_valor"], df["pred_moe"]))

    # Productos
    rows_prod = []
    for prod, grp in df_conf.groupby("producto"):
        da = (ref_dt - grp["fecha_dt"]).dt.days
        v90 = float(grp[da < 91]["valor_cop"].sum() / 1e6)
        vprev = float(grp[(da >= 91) & (da < 456)]["valor_cop"].sum() / 4.0 / 1e6)
        tend = ((v90 - vprev) / vprev) if vprev > 0 else 0.0
        rows_prod.append({
            "producto": prod,
            "ventas_confirmadas": int(len(grp)),
            "unidades": int(grp["cantidad"].sum()),
            "clientes_unicos": int(grp["customerId"].nunique()),
            "valor_historico_cop": float(grp["valor_cop"].sum()),
            "ticket_promedio_m": float(grp["valor_cop"].mean() / 1e6),
            "tendencia_90d": float(tend),
            "demanda_valor": float(0.6 * v90 + 0.4 * vprev),
        })
    df_prod = pd.DataFrame(rows_prod)
    xp_s = StandardScaler().fit_transform(df_prod[["ventas_confirmadas", "unidades", "clientes_unicos", "ticket_promedio_m", "tendencia_90d"]])
    xp_p = PCA(n_components=3, random_state=42).fit_transform(xp_s)
    df_prod[["pca_1", "pca_2", "pca_3"]] = xp_p
    pr_cl = KMeans(n_clusters=3, random_state=42, n_init="auto").fit_predict(xp_p)
    po = pd.Series(df_prod["demanda_valor"]).groupby(pr_cl).mean().sort_values(ascending=False).index.tolist()
    df_prod["cluster_demanda"] = [{old: new for new, old in enumerate(po)}[c] for c in pr_cl]
    p_glm = smf.glm("demanda_valor ~ pca_1 + pca_2 + pca_3 + tendencia_90d", data=df_prod, family=sm.families.Tweedie(var_power=1.5, link=sm.families.links.Log())).fit()
    df_prod["pred_glm"] = np.clip(p_glm.predict(df_prod), 0.0, None)

    xp_m = torch.tensor(StandardScaler().fit_transform(df_prod[["pca_1", "pca_2", "pca_3", "pred_glm"]]), dtype=torch.float32)
    py_m, py_s = float(df_prod["demanda_valor"].mean()), float(df_prod["demanda_valor"].std() or 1.0)
    yp_m = torch.tensor((df_prod["demanda_valor"].values - py_m) / py_s, dtype=torch.float32).unsqueeze(1)
    p_oh = torch.nn.functional.one_hot(torch.tensor(df_prod["cluster_demanda"].values), num_classes=3).float()
    p_moe = GreenSightMoE(4, 3)
    p_opt = optim.Adam(p_moe.parameters(), lr=0.02)
    for _ in range(350):
        p_opt.zero_grad()
        pp, pw = p_moe(xp_m)
        (crit(pp, yp_m) + 0.35 * crit(pw, p_oh)).backward()
        p_opt.step()
    with torch.no_grad():
        ppn, pwn = p_moe(xp_m)
        df_prod["pred_moe"] = np.clip(ppn.squeeze().numpy() * py_s + py_m, 0.0, None)
        pw_np = pwn.numpy()
        for e in range(3):
            df_prod[f"peso_exp_{e}"] = pw_np[:, e]
    df_prod = df_prod.sort_values("pred_moe", ascending=False).reset_index(drop=True)
    med_prod = float(df_prod["pred_moe"].median())

    report = {
        "metadata": {
            "modelName": "GreenSight ML · PCA + K-Means + GLM Tweedie + MoE",
            "source": "backend/app/services/ml_service.py (Colab Pipeline)",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "fechaReferencia": fecha_referencia,
            "nClientes": int(len(df)),
            "nVentasConfirmadas": int(len(df_conf)),
            "nProductos": int(len(df_prod)),
            "nClusters": 3,
            "tweedieVarPower": 1.5,
            "colabNotebookUrl": "https://colab.research.google.com/drive/1Ulr5twAm2ynI8B-U_zxaAy-HGUpNUu5Q",
        },
        "pca": {
            "explainedVarianceRatio": [round(float(x), 4) for x in pca.explained_variance_ratio_],
            "cumulativeVariance": round(float(pca.explained_variance_ratio_.sum()), 4),
            "features": features,
            "loadings": {f"pca_{k+1}": [round(float(v), 4) for v in pca.components_[k]] for k in range(3)},
        },
        "moeMetrics": {
            "mse": round(mse_val, 2),
            "rmse": round(rmse_val, 2),
            "mae": round(mae_val, 2),
            "r2": round(r2_val, 4),
            "silhouetteScore": round(sil_score, 4),
            "expertNames": EXPERT_NAMES,
        },
        "clusters": [
            {
                "clusterId": int(cid),
                "label": CLUSTER_LABELS[cid],
                "count": int((df["cluster"] == cid).sum()),
                "pct": round(float((df["cluster"] == cid).mean()), 4),
                "avgRecenciaDias": round(float(df[df["cluster"] == cid]["recencia_dias"].mean()), 1),
                "avgFrecuencia12m": round(float(df[df["cluster"] == cid]["frecuencia_compra"].mean()), 1),
                "avgTicketCOP": int(round(float(df[df["cluster"] == cid]["ticket_promedio"].mean() * 1e6))),
                "demandaGlmTotalCOP": int(round(float(df[df["cluster"] == cid]["pred_glm"].sum() * 1e6))),
                "demandaMoeTotalCOP": int(round(float(df[df["cluster"] == cid]["pred_moe"].sum() * 1e6))),
                "pesosExpertosPromedio": [round(float(df[df["cluster"] == cid][f"peso_exp_{e}"].mean()), 4) for e in range(3)],
                "centroidPca": [round(float(v), 4) for v in df[df["cluster"] == cid][["pca_1", "pca_2", "pca_3"]].mean()],
                "recomendacion": (
                    "Expansión comercial y upselling de suite documental" if cid == 0
                    else ("Fidelización y venta cruzada de servicios complementarios" if cid == 1
                          else "Campaña prioritaria de reactivación y soporte preventivo")
                ),
                "prioridad": "media" if cid == 1 else "alta",
            }
            for cid in range(3)
        ],
        "customers": [
            {
                "id": r["id"],
                "empresa": r["empresa"],
                "ciudad": r["ciudad"],
                "sector": r["sector"],
                "canal": r["canal"],
                "clusterId": int(r["cluster"]),
                "clusterLabel": CLUSTER_LABELS[int(r["cluster"])],
                "pca": [round(float(r["pca_1"]), 4), round(float(r["pca_2"]), 4), round(float(r["pca_3"]), 4)],
                "frecuencia12m": int(r["frecuencia_compra"]),
                "recenciaDias": int(r["recencia_dias"]),
                "ticketPromedioCOP": int(round(float(r["ticket_promedio"] * 1e6))),
                "demandaGlmCOP": int(round(float(r["pred_glm"] * 1e6))),
                "demandaMoeCOP": int(round(float(r["pred_moe"] * 1e6))),
                "pesosExpertos": [round(float(r[f"peso_exp_{e}"]), 4) for e in range(3)],
                "productoRecomendado": r["producto_recomendado"],
                "prioridad": "media" if (r["cluster"] == 1 and r["pred_moe"] < 15.0) else "alta",
                "recomendacion": (
                    "Alta prioridad / Reposición inmediata"
                    if (r["cluster"] == 0 or r["pred_moe"] >= 15.0)
                    else ("Reactivación prioritaria / Contacto comercial" if r["cluster"] == 2 else "Demanda estándar / Seguimiento periódico")
                ),
            }
            for _, r in df.iterrows()
        ],
        "products": [
            {
                "producto": r["producto"],
                "ventasConfirmadas": int(r["ventas_confirmadas"]),
                "unidades": int(r["unidades"]),
                "clientesUnicos": int(r["clientes_unicos"]),
                "valorHistoricoCOP": int(round(float(r["valor_historico_cop"]))),
                "ticketPromedioCOP": int(round(float(r["ticket_promedio_m"] * 1e6))),
                "tendencia90d": round(float(r["tendencia_90d"]), 4),
                "clusterDemanda": int(r["cluster_demanda"]),
                "demandaGlmCOP": int(round(float(r["pred_glm"] * 1e6))),
                "demandaMoeCOP": int(round(float(r["pred_moe"] * 1e6))),
                "pesosExpertos": [round(float(r[f"peso_exp_{e}"]), 4) for e in range(3)],
                "prioridad": "alta" if (r["pred_moe"] >= med_prod or r["tendencia_90d"] >= 0.08) else "media",
                "recomendacion": "Alta prioridad / Reposición inmediata" if (r["pred_moe"] >= med_prod or r["tendencia_90d"] >= 0.08) else "Demanda estándar",
            }
            for _, r in df_prod.iterrows()
        ],
    }

    out_path = _resolve_path("colab/greensight_insights.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report
