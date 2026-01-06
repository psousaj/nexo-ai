#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testando Webhook do WhatsApp ===${NC}\n"

# Carrega variáveis do .env
source .env

# URL base
BASE_URL="http://localhost:${PORT:-3000}"

# 1. Testa verificação do webhook (GET)
echo -e "${GREEN}1. Testando verificação do webhook (GET)${NC}"
curl -X GET "${BASE_URL}/webhook/meta?hub.mode=subscribe&hub.verify_token=${META_VERIFY_TOKEN}&hub.challenge=test123"
echo -e "\n"

# 2. Testa recebimento de mensagem (POST)
echo -e "${GREEN}2. Testando recebimento de mensagem (POST)${NC}"
curl -X POST "${BASE_URL}/webhook/meta" \
  -H "Content-Type: application/json" \
  -d '{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550000000",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Test User"
                },
                "wa_id": "5588988562749"
              }
            ],
            "messages": [
              {
                "from": "5588988562749",
                "id": "wamid.test123",
                "timestamp": "1234567890",
                "text": {
                  "body": "clube da luta"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}'
echo -e "\n"

# 3. Testa webhook sem mensagens (status update)
echo -e "${GREEN}3. Testando webhook sem mensagens (status)${NC}"
curl -X POST "${BASE_URL}/webhook/meta" \
  -H "Content-Type: application/json" \
  -d '{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550000000",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.test123",
                "status": "delivered",
                "timestamp": "1234567890"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}'
echo -e "\n"

echo -e "${BLUE}=== Testes concluídos ===${NC}"
