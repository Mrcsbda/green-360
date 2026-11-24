#!/usr/bin/env python3
"""
Genera src/data/colab/greensight_insights.json ejecutando el pipeline matemático
GreenSight (StandardScaler -> PCA -> K-Means -> GLM Tweedie -> Mixture of Experts)
sobre los datos reales de Green 360° (src/data/fixtures/*.json).

Nota: En Google Colab y en backend/app/ml/pipeline.py este mismo pipeline se ejecuta
con scikit-learn, statsmodels y PyTorch. Aquí se implementa en Python estándar para
reproducibilidad sin dependencias externas al regenerar el artefacto del repo.
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "src" / "data" / "fixtures"
OUT_PATH = ROOT / "src" / "data" / "colab" / "greensight_insights.json"

FECHA_REF = "2026-10-31"
COLAB_URL = "https://colab.research.google.com/drive/1Ulr5twAm2ynI8B-U_zxaAy-HGUpNUu5Q"


def parse_date(s: str) -> datetime:
    return datetime.strptime(s[:10], "%Y-%m-%d")


def days_between(a: str, b: str) -> int:
    return (parse_date(b) - parse_date(a)).days


def load_data():
    customers = json.loads((FIXTURES / "customers.json").read_text(encoding="utf-8"))
    sales = json.loads((FIXTURES / "sales.json").read_text(encoding="utf-8"))
    trm_list = json.loads((FIXTURES / "trm.json").read_text(encoding="utf-8"))
    trm_sorted = sorted(trm_list, key=lambda x: x[0])
    trm_map = dict(trm_sorted)

    def get_trm(fecha: str) -> float:
        if fecha in trm_map:
            return float(trm_map[fecha])
        prev = [float(v) for d, v in trm_sorted if d <= fecha]
        return prev[-1] if prev else float(trm_sorted[0][1])

    def value_cop(sale: dict) -> float:
        base = float(sale["cantidad"]) * float(sale["precioUnitario"])
        return base * get_trm(sale["fecha"]) if sale["moneda"] == "USD" else base

    return customers, sales, value_cop


def standardize(matrix: list[list[float]]) -> tuple[list[list[float]], list[float], list[float]]:
    n = len(matrix)
    d = len(matrix[0])
    means = [sum(row[j] for row in matrix) / n for j in range(d)]
    stds = []
    for j in range(d):
        var = sum((row[j] - means[j]) ** 2 for row in matrix) / max(1, n)
        stds.append(math.sqrt(var) or 1.0)
    scaled = [[(row[j] - means[j]) / stds[j] for j in range(d)] for row in matrix]
    return scaled, means, stds


def jacobi_eigen(sym: list[list[float]], max_iter: int = 100) -> tuple[list[float], list[list[float]]]:
    """Calcula eigenvalores y eigenvectores de una matriz simétrica d x d mediante rotaciones de Jacobi."""
    d = len(sym)
    a = [row[:] for row in sym]
    v = [[1.0 if i == j else 0.0 for j in range(d)] for i in range(d)]

    for _ in range(max_iter):
        p, q, max_val = 0, 1, 0.0
        for i in range(d):
            for j in range(i + 1, d):
                if abs(a[i][j]) > max_val:
                    max_val = abs(a[i][j])
                    p, q = i, j
        if max_val < 1e-11:
            break
        if abs(a[p][p] - a[q][q]) < 1e-12:
            theta = math.pi / 4.0
        else:
            theta = 0.5 * math.atan2(2.0 * a[p][q], a[q][q] - a[p][p])
        c, s = math.cos(theta), math.sin(theta)
        for i in range(d):
            if i != p and i != q:
                aip, aiq = a[i][p], a[i][q]
                a[i][p] = a[p][i] = c * aip - s * aiq
                a[i][q] = a[q][i] = s * aip + c * aiq
        app, aqq, apq = a[p][p], a[q][q], a[p][q]
        a[p][p] = c * c * app - 2.0 * s * c * apq + s * s * aqq
        a[q][q] = s * s * app + 2.0 * s * c * apq + c * c * aqq
        a[p][q] = a[q][p] = 0.0
        for i in range(d):
            vip, viq = v[i][p], v[i][q]
            v[i][p] = c * vip - s * viq
            v[i][q] = s * vip + c * viq

    eigvals = [a[i][i] for i in range(d)]
    order = sorted(range(d), key=lambda idx: eigvals[idx], reverse=True)
    sorted_vals = [max(0.0, eigvals[idx]) for idx in order]
    # Cada fila de components es un componente principal
    components = []
    for idx in order:
        vec = [v[row][idx] for row in range(d)]
        # Convención determinista de signo
        max_abs_i = max(range(d), key=lambda k: abs(vec[k]))
        if vec[max_abs_i] < 0:
            vec = [-x for x in vec]
        components.append(vec)
    return sorted_vals, components


def fit_pca(x_scaled: list[list[float]], n_components: int = 3):
    n = len(x_scaled)
    d = len(x_scaled[0])
    cov = [[0.0] * d for _ in range(d)]
    for row in x_scaled:
        for i in range(d):
            for j in range(d):
                cov[i][j] += row[i] * row[j]
    cov = [[cov[i][j] / max(1, n - 1) for j in range(d)] for i in range(d)]
    eigvals, components = jacobi_eigen(cov)
    total_var = sum(eigvals) or 1.0
    ratios = [eigvals[k] / total_var for k in range(n_components)]
    comps = components[:n_components]
    projected = [
        [sum(row[j] * comp[j] for j in range(d)) for comp in comps]
        for row in x_scaled
    ]
    return projected, ratios, comps


def sq_dist(a: list[float], b: list[float]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b))


def fit_kmeans(points: list[list[float]], k: int = 3, seed: int = 42):
    rng = random.Random(seed)
    n = len(points)
    d = len(points[0])
    # K-Means++ init determinista
    centroids = [points[0][:]]
    # Escoger el punto inicial más cercano a la media para reproducibilidad o seed fija
    first_idx = rng.randrange(n)
    centroids = [points[first_idx][:]]
    for _ in range(1, k):
        dists = [min(sq_dist(p, c) for c in centroids) for p in points]
        total = sum(dists) or 1.0
        r = rng.random() * total
        acc = 0.0
        chosen = 0
        for idx, dist in enumerate(dists):
            acc += dist
            if acc >= r:
                chosen = idx
                break
        centroids.append(points[chosen][:])

    labels = [0] * n
    for _ in range(100):
        changed = False
        for i, p in enumerate(points):
            best = min(range(k), key=lambda c: sq_dist(p, centroids[c]))
            if best != labels[i]:
                labels[i] = best
                changed = True
        new_centroids = [[0.0] * d for _ in range(k)]
        counts = [0] * k
        for lbl, p in zip(labels, points):
            counts[lbl] += 1
            for j in range(d):
                new_centroids[lbl][j] += p[j]
        for c in range(k):
            if counts[c] > 0:
                centroids[c] = [new_centroids[c][j] / counts[c] for j in range(d)]
        if not changed:
            break

    # Silhouette score
    sil_scores = []
    for i, p in enumerate(points):
        own = labels[i]
        same = [math.sqrt(sq_dist(p, points[j])) for j in range(n) if j != i and labels[j] == own]
        a_i = sum(same) / len(same) if same else 0.0
        other_means = []
        for c in range(k):
            if c == own:
                continue
            others = [math.sqrt(sq_dist(p, points[j])) for j in range(n) if labels[j] == c]
            if others:
                other_means.append(sum(others) / len(others))
        b_i = min(other_means) if other_means else 0.0
        denom = max(a_i, b_i)
        sil_scores.append((b_i - a_i) / denom if denom > 0 else 0.0)
    silhouette = sum(sil_scores) / len(sil_scores)
    return labels, centroids, silhouette


def solve_linear(a: list[list[float]], b: list[float]) -> list[float]:
    n = len(b)
    m = [a[i][:] + [b[i]] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[piv] = m[piv], m[col]
        diag = m[col][col] if abs(m[col][col]) > 1e-9 else 1e-9
        for j in range(col, n + 1):
            m[col][j] /= diag
        for r in range(n):
            if r != col and abs(m[r][col]) > 1e-12:
                factor = m[r][col]
                for j in range(col, n + 1):
                    m[r][j] -= factor * m[col][j]
    return [m[i][n] for i in range(n)]


def fit_tweedie_glm(x_rows: list[list[float]], y_vals: list[float], var_power: float = 1.5, l2: float = 1e-2) -> list[float]:
    """IRLS para GLM Tweedie con enlace logarítmico: g(mu) = log(mu) = X @ beta."""
    d = len(x_rows[0]) + 1
    design = [[1.0] + row for row in x_rows]
    mean_y = max(1.0, sum(y_vals) / max(1, len(y_vals)))
    beta = [math.log(mean_y)] + [0.0] * (d - 1)

    for _ in range(35):
        xtwx = [[l2 if i == j and i > 0 else 0.0 for j in range(d)] for i in range(d)]
        xtwz = [0.0] * d
        for x, y in zip(design, y_vals):
            eta = max(-6.0, min(12.0, sum(xi * bi for xi, bi in zip(x, beta))))
            mu = math.exp(eta)
            # Para enlace log: d_eta / d_mu = 1/mu; V(mu) = mu^var_power -> W = mu^(2 - var_power)
            w = max(1e-4, min(1e6, mu ** (2.0 - var_power)))
            z = eta + (y - mu) / max(1e-4, mu)
            for i in range(d):
                xtwz[i] += x[i] * w * z
                for j in range(d):
                    xtwx[i][j] += x[i] * w * x[j]
        new_beta = solve_linear(xtwx, xtwz)
        diff = max(abs(nb - ob) for nb, ob in zip(new_beta, beta))
        beta = new_beta
        if diff < 1e-6:
            break
    return beta


def predict_glm(beta: list[float], row: list[float]) -> float:
    x = [1.0] + row
    eta = max(-6.0, min(12.0, sum(xi * bi for xi, bi in zip(x, beta))))
    return math.exp(eta)


def softmax(logits: list[float]) -> list[float]:
    m = max(logits)
    exps = [math.exp(max(-20.0, min(20.0, x - m))) for x in logits]
    s = sum(exps) or 1.0
    return [e / s for e in exps]


def fit_moe(x_rows: list[list[float]], y_vals: list[float], cluster_ids: list[int], num_experts: int = 3):
    """
    Entrena un Mixture of Experts (3 expertos lineales + Gating Network Softmax con regularización
    de balanceo de carga) sobre características estandarizadas + predicción GLM normalizada.
    """
    x_std, x_mean, x_sd = standardize(x_rows)
    y_mean = sum(y_vals) / len(y_vals)
    y_sd = math.sqrt(sum((y - y_mean) ** 2 for y in y_vals) / len(y_vals)) or 1.0
    y_norm = [(y - y_mean) / y_sd for y in y_vals]

    d = len(x_std[0])
    rng = random.Random(42)

    # Pesos de expertos: cada experto e tiene W_e (d) y b_e
    exp_w = [[rng.gauss(0, 0.15) for _ in range(d)] for _ in range(num_experts)]
    exp_b = [0.0 for _ in range(num_experts)]

    # Gating network lineal + softmax con afinidad hacia expertos especializados por cluster
    gate_w = [[rng.gauss(0, 0.1) for _ in range(d)] for _ in range(num_experts)]
    gate_b = [0.0 for _ in range(num_experts)]

    lr = 0.08
    n = len(x_std)
    for epoch in range(420):
        g_exp_w = [[0.0] * d for _ in range(num_experts)]
        g_exp_b = [0.0] * num_experts
        g_gate_w = [[0.0] * d for _ in range(num_experts)]
        g_gate_b = [0.0] * num_experts

        for x, y, cid in zip(x_std, y_norm, cluster_ids):
            logits = [sum(gate_w[e][j] * x[j] for j in range(d)) + gate_b[e] for e in range(num_experts)]
            probs = softmax(logits)
            exp_out = [sum(exp_w[e][j] * x[j] for j in range(d)) + exp_b[e] for e in range(num_experts)]
            pred = sum(probs[e] * exp_out[e] for e in range(num_experts))
            err = pred - y

            for e in range(num_experts):
                for j in range(d):
                    g_exp_w[e][j] += (2.0 / n) * err * probs[e] * x[j] + 0.001 * exp_w[e][j] / n
                g_exp_b[e] += (2.0 / n) * err * probs[e]

            # Afinidad suave al cluster + minimización de error MSE (evita colapso de pesos)
            d_probs = [
                (2.0 / n) * err * exp_out[e] + (0.85 / n) * (probs[e] - (1.0 if e == cid else 0.0))
                for e in range(num_experts)
            ]
            dot_dp = sum(d_probs[k] * probs[k] for k in range(num_experts))
            for e in range(num_experts):
                d_logit = probs[e] * (d_probs[e] - dot_dp)
                for j in range(d):
                    g_gate_w[e][j] += d_logit * x[j] + 0.002 * gate_w[e][j] / n
                g_gate_b[e] += d_logit

        decay = 1.0 / (1.0 + 0.002 * epoch)
        step = lr * decay
        for e in range(num_experts):
            exp_b[e] -= step * g_exp_b[e]
            gate_b[e] -= step * g_gate_b[e]
            for j in range(d):
                exp_w[e][j] -= step * g_exp_w[e][j]
                gate_w[e][j] -= step * g_gate_w[e][j]

    preds = []
    weights_list = []
    for x in x_std:
        probs = softmax([sum(gate_w[e][j] * x[j] for j in range(d)) + gate_b[e] for e in range(num_experts)])
        exp_out = [sum(exp_w[e][j] * x[j] for j in range(d)) + exp_b[e] for e in range(num_experts)]
        y_hat = max(0.0, (sum(probs[e] * exp_out[e] for e in range(num_experts)) * y_sd + y_mean))
        preds.append(y_hat)
        weights_list.append(probs)

    mse = sum((p - y) ** 2 for p, y in zip(preds, y_vals)) / n
    mae = sum(abs(p - y) for p, y in zip(preds, y_vals)) / n
    var_y = sum((y - y_mean) ** 2 for y in y_vals) / n or 1.0
    r2 = 1.0 - mse / var_y
    return preds, weights_list, {"mse": mse, "rmse": math.sqrt(mse), "mae": mae, "r2": r2}


def build_insights():
    customers, sales, value_cop = load_data()
    conf_sales = [s for s in sales if s["estado"] == "Confirmada" and s["fecha"] <= FECHA_REF]

    sales_by_cust: dict[str, list[dict]] = {c["id"]: [] for c in customers}
    sales_by_prod: dict[str, list[dict]] = {}
    for s in conf_sales:
        sales_by_cust.setdefault(s["customerId"], []).append(s)
        sales_by_prod.setdefault(s["producto"], []).append(s)

    # 1. Matriz de características por cliente (en millones COP para estabilidad numérica)
    cust_rows = []
    cust_meta = []
    for c in customers:
        mine = sorted(sales_by_cust.get(c["id"], []), key=lambda x: x["fecha"])
        in12 = [s for s in mine if days_between(s["fecha"], FECHA_REF) < 365]
        in90 = [s for s in mine if days_between(s["fecha"], FECHA_REF) < 91]
        prev = [s for s in mine if 91 <= days_between(s["fecha"], FECHA_REF) < 456]

        freq_12m = len(in12)
        total_cop = sum(value_cop(s) for s in mine)
        val_12m = sum(value_cop(s) for s in in12)
        val_90d = sum(value_cop(s) for s in in90)
        prev_q_avg = sum(value_cop(s) for s in prev) / 4.0
        ticket_m = (total_cop / len(mine) / 1e6) if mine else 0.0
        recencia = float(days_between(mine[-1]["fecha"], FECHA_REF)) if mine else 365.0
        variedad = len({s["producto"] for s in mine})
        estacionalidad = (val_90d / prev_q_avg) if prev_q_avg > 0 else (1.2 if val_90d > 0 else 0.5)
        estacionalidad = max(0.3, min(2.5, estacionalidad))

        # Producto principal o recomendado por afinidad
        prod_totals: dict[str, float] = {}
        for s in mine:
            prod_totals[s["producto"]] = prod_totals.get(s["producto"], 0.0) + value_cop(s)
        top_prod = max(prod_totals.items(), key=lambda kv: kv[1])[0] if prod_totals else "Implementación documental"

        # Variable objetivo para GLM Tweedie + MoE: demanda proyectada trimestral (M COP)
        # Combina actividad reciente (90d) y ritmo anualizado para reflejar ceros reales en inactivos
        demanda_m = (0.65 * (val_90d / 1e6) + 0.35 * (val_12m / 4.0 / 1e6)) if mine else 0.0

        cust_rows.append([float(freq_12m), ticket_m, recencia, float(variedad), estacionalidad])
        cust_meta.append({
            "customer": c,
            "freq_12m": freq_12m,
            "ticket_cop": ticket_m * 1e6,
            "recencia": recencia,
            "variedad": variedad,
            "estacionalidad": estacionalidad,
            "demanda_m": demanda_m,
            "val_12m": val_12m,
            "top_prod": top_prod,
        })

    # 2. PCA + K-Means
    x_scaled, _, _ = standardize(cust_rows)
    x_pca, exp_var_ratios, pca_components = fit_pca(x_scaled, n_components=3)
    raw_clusters, centroids_pca, silhouette = fit_kmeans(x_pca, k=3, seed=42)

    # Ordenar IDs de cluster de mayor a menor demanda promedio (0 = Alto Valor, 1 = Recurrente, 2 = Riesgo/Reactivación)
    cluster_means = {}
    for cid in range(3):
        members = [m["demanda_m"] for m, cl in zip(cust_meta, raw_clusters) if cl == cid]
        cluster_means[cid] = sum(members) / max(1, len(members))
    ordered_old_ids = sorted(range(3), key=lambda cid: cluster_means[cid], reverse=True)
    remap = {old_id: new_id for new_id, old_id in enumerate(ordered_old_ids)}
    cluster_ids = [remap[c] for c in raw_clusters]
    centroids_ordered = [centroids_pca[old_id] for old_id in ordered_old_ids]

    # 3. GLM Tweedie (var_power=1.5) por cluster
    pred_glm_m = [0.0] * len(cust_meta)
    for cid in range(3):
        idxs = [i for i, c in enumerate(cluster_ids) if c == cid]
        sub_x = [x_pca[i] + [cust_meta[i]["estacionalidad"]] for i in idxs]
        sub_y = [cust_meta[i]["demanda_m"] for i in idxs]
        beta = fit_tweedie_glm(sub_x, sub_y, var_power=1.5)
        for i in idxs:
            pred_glm_m[i] = predict_glm(beta, x_pca[i] + [cust_meta[i]["estacionalidad"]])

    # 4. Mixture of Experts (MoE)
    moe_inputs = [x_pca[i] + [pred_glm_m[i]] for i in range(len(cust_meta))]
    y_targets = [m["demanda_m"] for m in cust_meta]
    pred_moe_m, weights_list, moe_metrics = fit_moe(moe_inputs, y_targets, cluster_ids, num_experts=3)

    # Etiquetas de negocio por cluster
    CLUSTER_DEFS = [
        ("Alto Valor / VIP", "alta", "Expansión comercial y upselling de suite documental"),
        ("Recurrentes / Crecimiento", "media", "Fidelización y venta cruzada de servicios complementarios"),
        ("En Riesgo / Reactivación", "alta", "Campaña prioritaria de reactivación y soporte preventivo"),
    ]
    EXPERT_NAMES = [
        "Experto 0 · Alto Valor",
        "Experto 1 · Recurrente",
        "Experto 2 · Reactivación",
    ]

    # Resumen por cluster
    clusters_summary = []
    for cid in range(3):
        idxs = [i for i, c in enumerate(cluster_ids) if c == cid]
        n_c = len(idxs)
        label, prio, reco = CLUSTER_DEFS[cid]
        avg_w = [
            round(sum(weights_list[i][e] for i in idxs) / max(1, n_c), 4)
            for e in range(3)
        ]
        clusters_summary.append({
            "clusterId": cid,
            "label": label,
            "count": n_c,
            "pct": round(n_c / len(customers), 4),
            "avgRecenciaDias": round(sum(cust_meta[i]["recencia"] for i in idxs) / max(1, n_c), 1),
            "avgFrecuencia12m": round(sum(cust_meta[i]["freq_12m"] for i in idxs) / max(1, n_c), 1),
            "avgTicketCOP": round(sum(cust_meta[i]["ticket_cop"] for i in idxs) / max(1, n_c)),
            "demandaGlmTotalCOP": round(sum(pred_glm_m[i] * 1e6 for i in idxs)),
            "demandaMoeTotalCOP": round(sum(pred_moe_m[i] * 1e6 for i in idxs)),
            "pesosExpertosPromedio": avg_w,
            "centroidPca": [round(v, 4) for v in centroids_ordered[cid]],
            "recomendacion": reco,
            "prioridad": prio,
        })

    # Detalle de clientes
    customers_out = []
    for i, meta in enumerate(cust_meta):
        c = meta["customer"]
        cid = cluster_ids[i]
        glm_cop = round(pred_glm_m[i] * 1e6)
        moe_cop = round(pred_moe_m[i] * 1e6)
        if cid == 0 or moe_cop >= 15_000_000:
            reco_txt = "Alta prioridad / Reposición inmediata"
            prio = "alta"
        elif cid == 2:
            reco_txt = "Reactivación prioritaria / Contacto comercial"
            prio = "alta"
        else:
            reco_txt = "Demanda estándar / Seguimiento periódico"
            prio = "media"
        customers_out.append({
            "id": c["id"],
            "empresa": c["empresa"],
            "ciudad": c["ciudad"],
            "sector": c["sector"],
            "canal": c["canal"],
            "clusterId": cid,
            "clusterLabel": CLUSTER_DEFS[cid][0],
            "pca": [round(v, 4) for v in x_pca[i]],
            "frecuencia12m": meta["freq_12m"],
            "recenciaDias": int(meta["recencia"]),
            "ticketPromedioCOP": round(meta["ticket_cop"]),
            "demandaGlmCOP": glm_cop,
            "demandaMoeCOP": moe_cop,
            "pesosExpertos": [round(w, 4) for w in weights_list[i]],
            "productoRecomendado": meta["top_prod"],
            "prioridad": prio,
            "recomendacion": reco_txt,
        })

    # 5. Predicción de productos de mayor necesidad (GLM Tweedie + MoE sobre los 10 productos)
    prod_rows = []
    prod_meta = []
    for prod, psales in sorted(sales_by_prod.items()):
        unidades = sum(float(s["cantidad"]) for s in psales)
        clientes_u = len({s["customerId"] for s in psales})
        hist_cop = sum(value_cop(s) for s in psales)
        ticket = hist_cop / len(psales)
        val_90 = sum(value_cop(s) for s in psales if days_between(s["fecha"], FECHA_REF) < 91)
        val_prev = sum(value_cop(s) for s in psales if 91 <= days_between(s["fecha"], FECHA_REF) < 456) / 4.0
        tendencia = ((val_90 - val_prev) / val_prev) if val_prev > 0 else 0.0
        demanda_m = (0.6 * (val_90 / 1e6) + 0.4 * (val_prev / 1e6))
        prod_rows.append([float(len(psales)), unidades, float(clientes_u), ticket / 1e6, tendencia])
        prod_meta.append({
            "producto": prod,
            "ventasConfirmadas": len(psales),
            "unidades": int(unidades),
            "clientesUnicos": clientes_u,
            "valorHistoricoCOP": round(hist_cop),
            "ticketPromedioCOP": round(ticket),
            "tendencia90d": round(tendencia, 4),
            "demanda_m": demanda_m,
        })

    p_scaled, _, _ = standardize(prod_rows)
    p_pca, _, _ = fit_pca(p_scaled, n_components=3)
    p_raw_cl, _, _ = fit_kmeans(p_pca, k=3, seed=42)
    p_cl_means = {cid: sum(prod_meta[i]["demanda_m"] for i, c in enumerate(p_raw_cl) if c == cid) / max(1, sum(1 for c in p_raw_cl if c == cid)) for cid in range(3)}
    p_order = sorted(range(3), key=lambda c: p_cl_means[c], reverse=True)
    p_remap = {old: new for new, old in enumerate(p_order)}
    p_cids = [p_remap[c] for c in p_raw_cl]

    p_glm_m = []
    p_beta = fit_tweedie_glm([p_pca[i] + [prod_meta[i]["tendencia90d"]] for i in range(len(prod_meta))], [m["demanda_m"] for m in prod_meta], var_power=1.5)
    for i in range(len(prod_meta)):
        p_glm_m.append(predict_glm(p_beta, p_pca[i] + [prod_meta[i]["tendencia90d"]]))

    p_moe_m, p_weights, _ = fit_moe(
        [p_pca[i] + [p_glm_m[i]] for i in range(len(prod_meta))],
        [m["demanda_m"] for m in prod_meta],
        p_cids,
        num_experts=3,
    )

    products_out = []
    med_moe = sorted(p_moe_m)[len(p_moe_m) // 2]
    for i, m in enumerate(prod_meta):
        moe_cop = round(p_moe_m[i] * 1e6)
        glm_cop = round(p_glm_m[i] * 1e6)
        alta = p_moe_m[i] >= med_moe or m["tendencia90d"] >= 0.08
        products_out.append({
            "producto": m["producto"],
            "ventasConfirmadas": m["ventasConfirmadas"],
            "unidades": m["unidades"],
            "clientesUnicos": m["clientesUnicos"],
            "valorHistoricoCOP": m["valorHistoricoCOP"],
            "ticketPromedioCOP": m["ticketPromedioCOP"],
            "tendencia90d": m["tendencia90d"],
            "clusterDemanda": p_cids[i],
            "demandaGlmCOP": glm_cop,
            "demandaMoeCOP": moe_cop,
            "pesosExpertos": [round(w, 4) for w in p_weights[i]],
            "prioridad": "alta" if alta else "media",
            "recomendacion": "Alta prioridad / Reposición inmediata" if alta else "Demanda estándar",
        })
    products_out.sort(key=lambda x: x["demandaMoeCOP"], reverse=True)

    report = {
        "metadata": {
            "modelName": "GreenSight ML · PCA + K-Means + GLM Tweedie + MoE",
            "source": "colab/Machine_Learning_GreenSight.ipynb",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "fechaReferencia": FECHA_REF,
            "nClientes": len(customers_out),
            "nVentasConfirmadas": len(conf_sales),
            "nProductos": len(products_out),
            "nClusters": 3,
            "tweedieVarPower": 1.5,
            "colabNotebookUrl": COLAB_URL,
        },
        "pca": {
            "explainedVarianceRatio": [round(r, 4) for r in exp_var_ratios],
            "cumulativeVariance": round(sum(exp_var_ratios), 4),
            "features": [
                "frecuencia_compra",
                "ticket_promedio",
                "recencia_dias",
                "variedad_categorias",
                "indice_estacionalidad",
            ],
            "loadings": {
                f"pca_{k+1}": [round(v, 4) for v in pca_components[k]]
                for k in range(3)
            },
        },
        "moeMetrics": {
            "mse": round(moe_metrics["mse"], 2),
            "rmse": round(moe_metrics["rmse"], 2),
            "mae": round(moe_metrics["mae"], 2),
            "r2": round(moe_metrics["r2"], 4),
            "silhouetteScore": round(silhouette, 4),
            "expertNames": EXPERT_NAMES,
        },
        "clusters": clusters_summary,
        "customers": customers_out,
        "products": products_out,
    }
    return report


def main():
    report = build_insights()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generado {OUT_PATH}")
    print(f"PCA varianza acumulada: {report['pca']['cumulativeVariance']:.2%}")
    print("Clusters:", [(c["clusterId"], c["label"], c["count"]) for c in report["clusters"]])
    print("MoE R2:", report["moeMetrics"]["r2"], "MSE (M^2 COP):", report["moeMetrics"]["mse"])
    print("Top 3 productos MoE:", [(p["producto"], round(p["demandaMoeCOP"] / 1e6, 2)) for p in report["products"][:3]])


if __name__ == "__main__":
    main()
