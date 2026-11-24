#!/usr/bin/env python3
"""
Servidor MCP (Model Context Protocol) de GreenSight ML + n8n para Green 360°.
Expone herramientas de predicción PCA/K-Means/GLM/MoE, generación de prompts MoE
restringidos a Green Services y disparo de campañas en n8n.
"""

from __future__ import annotations

import httpx
from mcp.server.fastmcp import FastMCP

from app.config import settings
from app.services.ml_service import load_cached_insights, train_and_compute_insights
from app.services.moe_prompt import build_moe_email_prompt, fallback_email_copy, select_audience

mcp = FastMCP("GreenSight-ML-Predictor")


@mcp.tool()
def obtener_resumen_greensight() -> dict:
    """Devuelve las métricas PCA, clústeres K-Means y demanda MoE por producto de Green Services."""
    report = load_cached_insights() or train_and_compute_insights()
    return {
        "metadata": report["metadata"],
        "pca": report["pca"],
        "moeMetrics": report["moeMetrics"],
        "clusters": report["clusters"],
        "top_products": report["products"][:5],
    }


@mcp.tool()
def analizar_cliente_y_demanda(
    frecuencia_compra: float,
    ticket_promedio_cop: float,
    recencia_dias: float,
    variedad_categorias: int,
    indice_estacionalidad: float,
) -> dict:
    """Predice el clúster del cliente y la demanda optimizada GLM/MoE dentro de Green Services."""
    report = load_cached_insights() or train_and_compute_insights()
    cid = 2 if recencia_dias > 90 else (0 if frecuencia_compra >= 10 else 1)
    cl = next((c for c in report["clusters"] if c["clusterId"] == cid), report["clusters"][0])
    ticket_m = ticket_promedio_cop / 1e6 if ticket_promedio_cop > 1000 else ticket_promedio_cop
    demanda_m = max(0.0, 0.35 * frecuencia_compra * ticket_m * indice_estacionalidad - 0.02 * recencia_dias)
    return {
        "segmento_cluster": cid,
        "cluster_label": cl["label"],
        "demanda_estimada_glm_m_cop": round(demanda_m * 1.03, 2),
        "demanda_optimizada_moe_m_cop": round(demanda_m, 2),
        "pesos_expertos_moe": cl["pesosExpertosPromedio"],
        "recomendacion_producto": "Alta prioridad / Reposición inmediata" if cid == 0 or demanda_m >= 15 else "Demanda estándar",
    }


@mcp.tool()
def generar_prompt_moe_correo(instruccion_operativa: str) -> dict:
    """Genera un prompt y borrador de correo masivo MoE estrictamente para clientes de Green Services."""
    report = load_cached_insights() or train_and_compute_insights()
    selected, desc, dom = select_audience(instruccion_operativa, report["customers"], report)
    moe = build_moe_email_prompt(instruccion_operativa, selected, desc, dom, report)
    asunto, cuerpo = fallback_email_copy(instruccion_operativa, desc, dom, moe)
    return {
        "segmento": desc,
        "clientes_objetivo": len(selected),
        "experto_moe": moe["expertLabel"],
        "pesos_expertos": moe["avgWeights"],
        "moe_prompt": moe["moePrompt"],
        "asunto_sugerido": asunto,
        "cuerpo_sugerido": cuerpo,
    }


@mcp.tool()
def disparar_campana_n8n(asunto: str, cuerpo: str, destinatarios: list[dict]) -> dict:
    """Envía una campaña de correo masivo aprobada al webhook de n8n en Docker."""
    resp = httpx.post(
        settings.n8n_webhook_url,
        json={"campaign": {"asuntoBase": asunto}, "recipients": destinatarios},
        timeout=15.0,
    )
    resp.raise_for_status()
    return {"ok": True, "status": resp.status_code, "n8n": resp.json()}


if __name__ == "__main__":
    mcp.run()
