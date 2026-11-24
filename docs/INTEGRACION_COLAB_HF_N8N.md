# Integración Green 360°: Google Colab (GreenSight ML) + Hugging Face + Docker n8n

## 1. Arquitectura integrada
- **Google Colab (`colab/Machine_Learning_GreenSight.ipynb`)**: carga los datos reales de `src/data/fixtures/` (`customers.json`, `sales.json`, `trm.json`), ejecuta **PCA + K-Means + GLM Tweedie (`var_power=1.5`) + Mixture of Experts (MoE)** y genera `src/data/colab/greensight_insights.json` consumido por el Dashboard.
- **Backend FastAPI + MCP (`backend/`)**: expone `/greensight/insights`, `/greensight/predict`, `/insights/ask` (conversaciones multi-turno con **Hugging Face** y **guardrail estricto solo Green Services**), `/automations/email-campaign` y el servidor **MCP** (`backend/mcp_greensight_server.py`).
- **Docker gratuito (`docker-compose.yml`)**: levanta `n8n` (Community Edition), `mailpit` (SMTP + bandeja web gratuita para pruebas locales) y `greensight-api`.

## 2. Levantar n8n + Hugging Face + API en Docker
1. Crea un archivo `.env` en la raíz (puedes copiar `.env.example`):
   ```env
   HF_TOKEN=hf_tu_token_gratuito_de_huggingface
   HF_MODEL=meta-llama/Llama-3.1-8B-Instruct
   EXPO_PUBLIC_AI_MODE=connected
   EXPO_PUBLIC_AI_API_URL=http://localhost:8000
   ```
2. Inicia los servicios gratuitos en Docker:
   ```bash
   docker compose up -d --build
   ```
3. Verifica los servicios:
   - **API GreenSight + Hugging Face**: http://localhost:8000/health
   - **n8n (flujos ya importados y activos)**: http://localhost:5678
   - **Mailpit (correos masivos recibidos en prueba gratuita)**: http://localhost:8025
4. Inicia el frontend web de Green 360°:
   ```bash
   npm run web
   ```
   *(También puedes pegar la URL `http://localhost:8000` o un túnel de Google Colab directamente desde el botón **Conectar Colab / API** en el Dashboard).*

## 3. Enviar correos reales por SMTP (opcional)
Por defecto `docker-compose.yml` usa **Mailpit** (`mailpit:1025`) para probar campañas masivas sin costo ni bloqueos. Para enviar correos reales (por ejemplo Gmail con App Password):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SSL=true
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_app_password_16_digitos
SMTP_SENDER=tu_correo@gmail.com
```
Luego recrea `n8n` borrando el marcador inicial o actualizando la credencial **Green 360 SMTP** en n8n.

## 4. Flujo de texto a correo masivo con MoE
En el **Chat IA**, un operativo puede escribir:
- *"Manda un correo masivo a los clientes fríos de Bogotá invitándolos a reactivar su servicio de respaldo"*
- *"Crea una campaña de correo con MoE para los clientes de alta prioridad"*

El orquestador **MoE** selecciona los clientes, calcula el experto dominante (`Alto Valor`, `Recurrente` o `Reactivación`) y el producto foco de Green Services, arma el prompt MoE para **Hugging Face** y muestra una **vista previa editable** con el botón **Enviar vía n8n**.
