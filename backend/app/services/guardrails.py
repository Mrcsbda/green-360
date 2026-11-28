from __future__ import annotations

import re
import unicodedata


def normalize_text(text: str) -> str:
    nfd = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn").lower().strip()


GREEN_SERVICES_TERMS = (
    "green services",
    "green 360",
    "green360",
    "greensight",
    "cliente",
    "clientes",
    "empresa",
    "empresas",
    "venta",
    "ventas",
    "compra",
    "compras",
    "recompra",
    "segment",
    "frecuente",
    "frio",
    "inactiv",
    "riesgo",
    "cluster",
    "kmeans",
    "k-means",
    "pca",
    "glm",
    "tweedie",
    "moe",
    "mixture of experts",
    "experto",
    "mcp",
    "colab",
    "demanda",
    "producto",
    "productos",
    "servicio",
    "servicios",
    "documental",
    "respaldo",
    "backup",
    "almacenamiento",
    "digitalizacion",
    "migracion",
    "continuidad",
    "soporte",
    "licencia",
    "licencias",
    "capacitacion",
    "capacitaciones",
    "consulta",
    "consultas",
    "ciudad",
    "ciudades",
    "bogota",
    "medellin",
    "cali",
    "barranquilla",
    "canal",
    "whatsapp",
    "llamada",
    "visita",
    "correo",
    "correos",
    "email",
    "masivo",
    "masiva",
    "campana",
    "n8n",
    "automatizacion",
    "automatizar",
    "reactivar",
    "reactivacion",
    "fidelizar",
    "upselling",
    "oportunidad",
    "oportunidades",
    "prioridad",
    "prioritario",
    "alerta",
    "alertas",
    "trm",
    "cop",
    "usd",
    "facturacion",
    "ticket",
    "recencia",
    "frecuencia",
    "dashboard",
    "grafica",
    "indicador",
    "kpi",
    "operativo",
    "operacion",
    "promocion",
    "prompt",
    "reposicion",
    "vip",
    "recurrente",
    "resumen",
    "metrica",
    "total",
    "sector",
    "vencid",
    "vencer",
    "mensual",
    "facturado",
    "facturo",
    "compro",
    "quienes son",
    "que ofrecen",
    "que hacen",
)

_CLIENT_NUM_RE = re.compile(r"\b(?:cliente|empresa)s?(?: de prueba)?\s*(?:#|no\.?|numero)?\s*0*(\d{1,4})\b")


def find_mentioned_clients(text: str, clientes: list[dict] | None) -> list[dict]:
    """Clientes registrados mencionados por nombre completo o por número ("cliente 7", "cliente de prueba 007")."""
    q = normalize_text(text or "")
    if not q or not clientes:
        return []
    nums = {int(n) for n in _CLIENT_NUM_RE.findall(q)}
    found = []
    for c in clientes:
        name = normalize_text(str(c.get("empresa", "")))
        tail = re.search(r"(\d+)$", name)
        if (len(name) >= 4 and name in q) or (tail and int(tail.group(1)) in nums):
            found.append(c)
    return found[:5]

OFF_TOPIC_PATTERNS = (
    r"\b(clima|tiempo|lluvia|pronostico)\b",
    r"\b(futbol|partido|mundial|gol|nba|tenis|deporte)\b",
    r"\b(receta|cocina|pasta|hamburguesa|pizza|postre)\b",
    r"\b(pelicula|serie|netflix|musica|cancion|chiste|poema|cuento)\b",
    r"\b(politica|elecciones|presidente|guerra|religion)\b",
    r"\b(horoscopo|zodiaco|tarot|loteria)\b",
    r"(ignora(r)? (las )?instrucciones|ignore previous|forget your rules|jailbreak|modo dan)",
)

GREETINGS = ("hola", "buenos dias", "buenas tardes", "buenas noches", "gracias", "ok", "perfecto", "listo", "ayuda", "que puedes hacer")

AUTOMATION_TERMS = (
    "correo masivo",
    "correos masivos",
    "enviar correo",
    "envia correo",
    "enviale un correo",
    "enviales un correo",
    "manda un correo",
    "mandar correo",
    "mandales",
    "campana",
    "email masivo",
    "automatiz",
    "n8n",
    "difusion",
    "notificacion masiva",
    "reactivacion por correo",
)


def is_automation_request(question: str) -> bool:
    q = normalize_text(question)
    return any(term in q for term in AUTOMATION_TERMS)


def check_green_services_scope(question: str, history: list[dict] | None = None, mentions_customer: bool = False) -> tuple[bool, str]:
    """
    Valida que la conversación permanezca estrictamente dentro del dominio de Green Services / Green 360°.
    Retorna (allowed, reason).
    """
    q = normalize_text(question)
    if not q:
        return False, "Por favor escribe una consulta sobre clientes, analítica GreenSight o automatizaciones de Green Services."

    for pat in OFF_TOPIC_PATTERNS:
        if re.search(pat, q):
            return (
                False,
                "Solo estoy autorizado para responder y asistir en temas de **Green Services / Green 360°** "
                "(clientes, ventas, segmentación, predicciones GreenSight ML/MoE, licencias, capacitaciones, "
                "consultas y automatizaciones operativas en n8n).",
            )

    if mentions_customer or any(term in q for term in GREEN_SERVICES_TERMS):
        return True, "green_services_keyword"

    # Saludos cortos o seguimiento directo cuando la conversación previa es sobre Green Services
    if any(q == g or q.startswith(f"{g} ") for g in GREETINGS):
        return True, "greeting"

    follow_up_markers = ("y a esos", "esos", "cuales", "cuantos", "hazlo", "cambiale", "mejora", "mas formal", "mas corto", "envialo", "repite", "explica", "detalle", "por que")
    # Seguimiento corto dentro de una conversación ya iniciada sobre Green Services ("¿y en Cali?").
    if history and (any(m in q for m in follow_up_markers) or len(q.split()) <= 6):
        return True, "follow_up"

    return (
        False,
        "Mi alcance está restringido exclusivamente a **Green Services (Green 360°)**: "
        "puedo analizar clientes, ventas, clústeres PCA/K-Means, demanda GLM/MoE, servicios documentales "
        "y generar campañas de correo masivo vía n8n. Reformula tu pregunta dentro de este contexto.",
    )
