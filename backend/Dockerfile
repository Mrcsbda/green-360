FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Instalar PyTorch CPU primero para mantener la imagen ligera y gratuita
RUN pip install --upgrade pip && \
    pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 && \
    pip install fastapi>=0.115.0 uvicorn[standard]>=0.30.0 pydantic>=2.9.0 httpx>=0.27.0 \
        numpy>=1.26.0 pandas>=2.2.0 scikit-learn>=1.5.0 statsmodels>=0.14.0 mcp>=1.2.0

COPY app ./app
COPY mcp_greensight_server.py ./mcp_greensight_server.py

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
