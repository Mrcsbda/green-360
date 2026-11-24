#!/bin/sh
set -e

CRED_FILE="/tmp/green360-smtp-cred.json"
MARKER="/home/node/.n8n/.green360_bootstrapped"

SMTP_HOST_VAL="${SMTP_HOST:-mailpit}"
SMTP_PORT_VAL="${SMTP_PORT:-1025}"
SMTP_USER_VAL="${SMTP_USER:-}"
SMTP_PASS_VAL="${SMTP_PASS:-}"
SMTP_SSL_VAL="${SMTP_SSL:-false}"

cat > "$CRED_FILE" <<EOF
[
  {
    "id": "green360-smtp",
    "name": "Green 360 SMTP",
    "type": "smtp",
    "data": {
      "host": "$SMTP_HOST_VAL",
      "port": $SMTP_PORT_VAL,
      "user": "$SMTP_USER_VAL",
      "password": "$SMTP_PASS_VAL",
      "ssl": $SMTP_SSL_VAL,
      "disableStartTls": true
    }
  }
]
EOF

if [ ! -f "$MARKER" ]; then
  echo "[Green 360 n8n] Importando credencial SMTP y flujos iniciales..."
  n8n import:credentials --input="$CRED_FILE" || true
  n8n import:workflow --separate --input=/workflows || true
  n8n update:workflow --all --active=true || true
  touch "$MARKER"
fi

exec n8n start
