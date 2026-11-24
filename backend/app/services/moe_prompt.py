from __future__ import annotations

from typing import Any

from app.services.guardrails import normalize_text


def select_audience(
    pregunta: str,
    clientes: list[dict[str, Any]],
    ml_report: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], str, int]:
    """
    Filtra los clientes objetivo según el pedido textual del operativo y los clústeres MoE.
    Retorna (clientes_seleccionados, descripcion_segmento, cluster_dominante).
    """
    q = normalize_text(pregunta)
    ml_by_id = {c["id"]: c for c in (ml_report or {}).get("customers", [])}

    enriched: list[dict[str, Any]] = []
    for c in clientes:
        ml = ml_by_id.get(c["id"], {})
        enriched.append({
            "id": c["id"],
            "empresa": c.get("empresa", ""),
            "email": (c.get("email") or "").strip(),
            "contacto": (c.get("contacto") or "").strip(),
            "ciudad": c.get("ciudad", ""),
            "sector": c.get("sector", ""),
            "canal": c.get("canal", ""),
            "segmento": c.get("segmento", "sin_segmentar"),
            "diasSinCompra": c.get("diasSinCompra"),
            "valor12m": c.get("valor12m", 0),
            "clusterId": ml.get("clusterId", 2 if c.get("segmento") == "frio" else (0 if c.get("segmento") == "frecuente" else 1)),
            "clusterLabel": ml.get("clusterLabel", "En Riesgo / Reactivación" if c.get("segmento") == "frio" else "Recurrentes / Crecimiento"),
            "demandaMoeCOP": ml.get("demandaMoeCOP", c.get("valor12m", 0) * 0.25),
            "demandaGlmCOP": ml.get("demandaGlmCOP", c.get("valor12m", 0) * 0.25),
            "pesosExpertos": ml.get("pesosExpertos", [0.33, 0.34, 0.33]),
            "productoRecomendado": ml.get("productoRecomendado", "Implementación documental"),
        })

    selected = enriched
    labels: list[str] = []

    # Filtro geográfico
    cities = [city for city in ("bogota", "medellin", "cali", "barranquilla") if city in q]
    if cities:
        selected = [c for c in selected if normalize_text(c["ciudad"]) in cities]
        labels.append(f"ciudad: {', '.join(c.title() for c in cities)}")

    # Filtro por segmento / clúster MoE
    if "frio" in q or "inactiv" in q or "riesgo" in q or "reactiv" in q:
        selected = [c for c in selected if c["segmento"] == "frio" or c["clusterId"] == 2]
        labels.append("clientes fríos / clúster en riesgo")
    elif "vip" in q or "alto valor" in q or "alta prioridad" in q or "reposicion" in q:
        selected = [c for c in selected if c["clusterId"] == 0 or c["demandaMoeCOP"] >= 15_000_000]
        labels.append("clúster Alto Valor / VIP (MoE)")
    elif "frecuent" in q or "recurrent" in q or "fideliz" in q:
        selected = [c for c in selected if c["segmento"] == "frecuente" or c["clusterId"] == 1]
        labels.append("clientes frecuentes / recurrentes")
    elif "sin segmentar" in q:
        selected = [c for c in selected if c["segmento"] == "sin_segmentar"]
        labels.append("clientes sin segmentar")

    if not selected:
        selected = sorted(enriched, key=lambda x: x["demandaMoeCOP"], reverse=True)[:15]
        labels.append("top 15 por demanda MoE")

    # Clúster dominante en el subconjunto seleccionado
    counts = {0: 0, 1: 0, 2: 0}
    for c in selected:
        cid = int(c.get("clusterId", 1))
        counts[cid] = counts.get(cid, 0) + 1
    dom_cluster = max(counts.items(), key=lambda kv: kv[1])[0]
    desc = " · ".join(labels) if labels else "todos los clientes visibles"
    return selected, desc, dom_cluster


def build_moe_email_prompt(
    pregunta: str,
    selected: list[dict[str, Any]],
    segment_desc: str,
    dom_cluster: int,
    ml_report: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Construye el prompt orquestado por Mixture of Experts (MoE) para redactar el correo masivo
    de Green Services usando los pesos de expertos, clúster K-Means y producto recomendado.
    """
    n = max(1, len(selected))
    avg_weights = [
        round(sum(c["pesosExpertos"][i] for c in selected) / n, 3)
        for i in range(3)
    ]
    total_moe_m = round(sum(c["demandaMoeCOP"] for c in selected) / 1e6, 2)
    total_glm_m = round(sum(c["demandaGlmCOP"] for c in selected) / 1e6, 2)

    prod_counts: dict[str, int] = {}
    for c in selected:
        p = c.get("productoRecomendado") or "Implementación documental"
        prod_counts[p] = prod_counts.get(p, 0) + 1
    top_product = max(prod_counts.items(), key=lambda kv: kv[1])[0]

    top_ml_products = [p["producto"] for p in (ml_report or {}).get("products", [])[:3]]
    expert_focus = {
        0: ("Experto 0 · Alto Valor / Expansión", "tono ejecutivo, énfasis en continuidad operativa, escalabilidad documental e implementación prioritaria"),
        1: ("Experto 1 · Recurrente / Fidelización", "tono cercano consultivo, énfasis en renovación ágil, licencias y optimización de respaldo en la nube"),
        2: ("Experto 2 · Reactivación / Riesgo", "tono empático orientado a recuperar relación comercial, diagnóstico sin costo, soporte operativo y respaldo preventivo"),
    }[dom_cluster]

    moe_prompt = (
        f"[ORQUESTADOR MoE GREENSIGHT]\n"
        f"- Segmento objetivo: {segment_desc} ({len(selected)} clientes)\n"
        f"- Clúster dominante K-Means: {dom_cluster} | {expert_focus[0]}\n"
        f"- Pesos promedio de enrutamiento MoE [E0, E1, E2]: {avg_weights}\n"
        f"- Demanda estimada GLM Tweedie: ${total_glm_m} M COP | Optimizada MoE: ${total_moe_m} M COP\n"
        f"- Producto foco recomendado: {top_product} (Top portafolio MoE: {', '.join(top_ml_products) or top_product})\n"
        f"- Directriz de redacción: {expert_focus[1]}. Restringido 100% a servicios de Green Services.\n"
        f"- Solicitud del operativo: {pregunta}"
    )

    return {
        "moePrompt": moe_prompt,
        "expertLabel": expert_focus[0],
        "avgWeights": avg_weights,
        "topProduct": top_product,
        "totalMoeMillones": total_moe_m,
        "totalGlmMillones": total_glm_m,
    }


def fallback_email_copy(
    pregunta: str,
    segment_desc: str,
    dom_cluster: int,
    moe_info: dict[str, Any],
) -> tuple[str, str]:
    """Plantilla inteligente condicionada por el experto MoE dominante (cuando no hay HF_TOKEN)."""
    top_prod = moe_info["topProduct"]
    if dom_cluster == 2:
        asunto = f"Green Services · Retomemos su gestión en {top_prod} con diagnóstico prioritario"
        cuerpo = (
            "Hola {{empresa}},\n\n"
            f"En Green Services valoramos la continuidad operativa de su equipo en {{ciudad}}. "
            f"Nuestro sistema GreenSight identificó una oportunidad clave para reactivar su cobertura en {top_prod}, "
            "asegurando respaldo en la nube, consulta histórica y soporte operativo sin fricciones.\n\n"
            "Queremos ofrecerles una sesión de revisión de continuidad sin costo esta semana para validar licencias, "
            "tiempos de respuesta y próximos requerimientos documentales.\n\n"
            "¿Le parece bien agendar una breve llamada de 15 minutos?\n\n"
            "Cordialmente,\nEquipo Comercial · Green Services (Green 360°)"
        )
    elif dom_cluster == 0:
        asunto = f"Green Services · Plan de expansión prioritaria en {top_prod}"
        cuerpo = (
            "Estimado equipo de {{empresa}},\n\n"
            f"Gracias por su confianza continua en Green Services. De acuerdo con nuestra proyección de demanda GreenSight MoE, "
            f"su operación en {{ciudad}} se encuentra en nivel prioritario para escalar capacidades en {top_prod} "
            "y gestión documental avanzada.\n\n"
            "Ponemos a su disposición cupos preferenciales de implementación, migración asistida y capacitación de usuarios "
            "para asegurar disponibilidad total en el próximo trimestre.\n\n"
            "Quedamos atentos para coordinar su propuesta personalizada.\n\n"
            "Atentamente,\nDirección de Cuentas Estratégicas · Green Services"
        )
    else:
        asunto = f"Green Services · Optimice su operación con {top_prod}"
        cuerpo = (
            "Hola {{empresa}},\n\n"
            f"En Green Services acompañamos su crecimiento en {{ciudad}}. Con base en su historial comercial, "
            f"preparamos recomendaciones en {top_prod}, licenciamiento documental y respaldo programado "
            "para mantener su operación al día.\n\n"
            "Si desea revisar cobertura, renovaciones o capacitaciones para su equipo, responda a este correo "
            "y un especialista de Green Services lo contactará.\n\n"
            "Un saludo,\nEquipo Operativo y Comercial · Green Services"
        )

    return asunto, cuerpo
