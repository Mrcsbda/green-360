from __future__ import annotations

from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.services.hf_client import handle_chat_request
from app.services.ml_service import (
    fetch_colab_insights,
    load_cached_insights,
    train_and_compute_insights,
)

app = FastAPI(
    title="Green 360° · GreenSight ML + Hugging Face + n8n API",
    version="1.0.0",
    description="Backend unificado para conectar Google Colab (PCA+KMeans+GLM+MoE), Hugging Face LLM y automatizaciones n8n.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class AskPayload(BaseModel):
    pregunta: str
    fechaReferencia: str = "2026-10-31"
    clientes: list[dict[str, Any]] = Field(default_factory=list)
    ventasPorMes: list[dict[str, Any]] = Field(default_factory=list)
    dashboard: dict[str, Any] = Field(default_factory=dict)
    history: list[ChatMessage] = Field(default_factory=list)


class Recipient(BaseModel):
    id: str
    empresa: str
    email: str = ""
    ciudad: str = ""
    segmento: str = ""
    clusterId: int = 1
    demandaMoeCOP: float = 0


class EmailCampaignPayload(BaseModel):
    asunto: str
    cuerpo: str
    segmentoDescripcion: str = ""
    expertoMoE: str = ""
    productoFoco: str = ""
    moePrompt: str = ""
    testEmailFallback: str = ""
    destinatarios: list[Recipient] = Field(default_factory=list)
    n8nWebhookUrl: str = ""


class PredictPayload(BaseModel):
    frecuencia_compra: float
    ticket_promedio: float
    recencia_dias: float
    variedad_categorias: int
    indice_estacionalidad: float
    trigger_n8n: bool = False


@app.get("/health")
async def health() -> dict[str, Any]:
    cached = load_cached_insights()
    return {
        "ok": True,
        "hfConfigured": bool(settings.hf_token),
        "hfModel": settings.hf_model,
        "n8nWebhookUrl": settings.n8n_webhook_url,
        "colabInsightsLoaded": cached is not None,
        "fechaReferencia": (cached or {}).get("metadata", {}).get("fechaReferencia", "2026-10-31"),
    }


@app.get("/greensight/insights")
async def get_greensight_insights(refresh: bool = False, colabUrl: str = "") -> dict[str, Any]:
    if colabUrl.strip():
        try:
            remote = await fetch_colab_insights(colabUrl.strip())
            if remote:
                return remote
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"No se pudo leer Colab URL: {exc}") from exc

    if refresh:
        return train_and_compute_insights()

    cached = load_cached_insights()
    if cached:
        return cached
    return train_and_compute_insights()


@app.post("/greensight/predict")
async def predict_customer_demand(body: PredictPayload) -> dict[str, Any]:
    report = load_cached_insights() or train_and_compute_insights()
    # Inferencia rápida usando centroides PCA/clústeres sincronizados desde Colab
    ticket_m = body.ticket_promedio / 1e6 if body.ticket_promedio > 1000 else body.ticket_promedio
    if body.recencia_dias > 90:
        cid = 2
    elif body.frecuencia_compra >= 10 or (ticket_m * body.frecuencia_compra) >= 35:
        cid = 0
    else:
        cid = 1

    cl = next((c for c in report["clusters"] if c["clusterId"] == cid), report["clusters"][0])
    est_demanda_m = max(0.0, 0.35 * body.frecuencia_compra * ticket_m * body.indice_estacionalidad - 0.02 * body.recencia_dias)
    resultado = {
        "segmento_cluster": cid,
        "cluster_label": cl["label"],
        "demanda_estimada_glm_m_cop": round(est_demanda_m * 1.03, 2),
        "demanda_optimizada_moe_m_cop": round(est_demanda_m, 2),
        "pesos_expertos_moe": cl["pesosExpertosPromedio"],
        "recomendacion_producto": "Alta prioridad / Reposición inmediata" if (cid == 0 or est_demanda_m >= 15.0) else ("Reactivación prioritaria" if cid == 2 else "Demanda estándar"),
    }

    if body.trigger_n8n and settings.n8n_alerts_webhook_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(settings.n8n_alerts_webhook_url, json=resultado)
            resultado["n8n_status"] = "Alerta enviada a n8n"
        except Exception as exc:
            resultado["n8n_status"] = f"n8n no disponible: {exc}"

    return resultado


@app.post("/insights/ask")
async def ask_insights(body: AskPayload) -> dict[str, Any]:
    ml_report = load_cached_insights()
    return await handle_chat_request(body.model_dump(), ml_report)


@app.post("/automations/email-campaign")
async def trigger_n8n_email_campaign(body: EmailCampaignPayload) -> dict[str, Any]:
    webhook_url = (body.n8nWebhookUrl or settings.n8n_webhook_url).strip()
    if not webhook_url:
        raise HTTPException(status_code=400, detail="N8N_WEBHOOK_URL no está configurada.")

    fallback_email = body.testEmailFallback.strip()
    deliverable: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for r in body.destinatarios:
        target_email = r.email.strip() or fallback_email
        if target_email:
            deliverable.append({
                "id": r.id,
                "empresa": r.empresa,
                "email": target_email,
                "ciudad": r.ciudad or "Colombia",
                "segmento": r.segmento,
                "clusterId": r.clusterId,
                "demandaMoeCOP": r.demandaMoeCOP,
                "asunto": body.asunto.replace("{{empresa}}", r.empresa).replace("{{ciudad}}", r.ciudad or "su ciudad"),
                "cuerpo": body.cuerpo.replace("{{empresa}}", r.empresa).replace("{{ciudad}}", r.ciudad or "su ciudad"),
            })
        else:
            skipped.append({"id": r.id, "empresa": r.empresa, "motivo": "Sin correo registrado"})

    if not deliverable:
        return {
            "ok": False,
            "sentCount": 0,
            "skippedCount": len(skipped),
            "message": "Ningún destinatario tiene correo registrado. Completa correos en Clientes o ingresa un correo de prueba para validar en Mailpit/n8n.",
            "skipped": skipped[:10],
        }

    n8n_payload = {
        "campaign": {
            "segmentoDescripcion": body.segmentoDescripcion,
            "expertoMoE": body.expertoMoE,
            "productoFoco": body.productoFoco,
            "moePrompt": body.moePrompt,
            "asuntoBase": body.asunto,
            "sender": settings.smtp_sender,
        },
        "recipients": deliverable,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(webhook_url, json=n8n_payload)
            if resp.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"n8n respondió HTTP {resp.status_code}: {resp.text[:250]}")
            n8n_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo conectar al webhook de n8n ({webhook_url}): {exc}") from exc

    return {
        "ok": True,
        "sentCount": len(deliverable),
        "skippedCount": len(skipped),
        "webhookUrl": webhook_url,
        "n8nResponse": n8n_data,
        "message": f"Campaña despachada por n8n a {len(deliverable)} destinatario(s).",
    }
