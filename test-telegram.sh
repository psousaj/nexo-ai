#!/bin/bash

# Script para testar webhook do Telegram localmente
# Simula uma mensagem enviada pelo Telegram Bot API

if [ -z "$1" ]; then
  echo "❌ Uso: ./test-telegram.sh \"mensagem\""
  echo "Exemplo: ./test-telegram.sh \"clube da luta\""
  exit 1
fi

MESSAGE_TEXT="$1"

# Payload simulando uma mensagem do Telegram
# Formato: https://core.telegram.org/bots/api#message
PAYLOAD=$(cat <<EOF
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "Teste",
      "last_name": "Usuario",
      "username": "testuser",
      "language_code": "pt-BR"
    },
    "chat": {
      "id": 123456789,
      "first_name": "Teste",
      "last_name": "Usuario",
      "username": "testuser",
      "type": "private"
    },
    "date": $(date +%s),
    "text": "$MESSAGE_TEXT"
  }
}
EOF
)

echo "📤 Enviando mensagem: \"$MESSAGE_TEXT\""
echo ""

# Envia para webhook local
curl -X POST http://localhost:3000/webhook/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: meu_secret_opcional" \
  -d "$PAYLOAD" \
  -w "\n\n📊 Status: %{http_code}\n" \
  -s

echo ""
echo "✅ Teste concluído!"
echo "📋 Verifique os logs do servidor para ver a resposta processada."
