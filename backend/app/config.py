from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    hf_token: str = os.getenv("HF_TOKEN", "").strip()
    hf_base_url: str = os.getenv("HF_BASE_URL", "https://router.huggingface.co/v1").rstrip("/")
    hf_model: str = os.getenv("HF_MODEL", "meta-llama/Llama-3.1-8B-Instruct").strip()
    hf_fallback_models: tuple[str, ...] = tuple(
        m.strip()
        for m in os.getenv(
            "HF_FALLBACK_MODELS",
            "Qwen/Qwen3.5-9B,google/gemma-3-4b-it,meta-llama/Llama-3.2-3B-Instruct",
        ).split(",")
        if m.strip()
    )
    n8n_webhook_url: str = os.getenv("N8N_WEBHOOK_URL", "http://n8n:5678/webhook/green360-mass-email").strip()
    n8n_alerts_webhook_url: str = os.getenv("N8N_ALERTS_WEBHOOK_URL", "http://n8n:5678/webhook/greensight-ml-alert").strip()
    colab_insights_url: str = os.getenv("COLAB_INSIGHTS_URL", "").strip()
    data_dir: Path = Path(os.getenv("GREEN360_DATA_DIR", "/data"))
    smtp_host: str = os.getenv("SMTP_HOST", "mailpit").strip()
    smtp_port: int = int(os.getenv("SMTP_PORT", "1025"))
    smtp_sender: str = os.getenv("SMTP_SENDER", "operaciones@greenservices.co").strip()


settings = Settings()
