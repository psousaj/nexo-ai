#!/bin/bash

# Simula o webhook que o Meta enviaria quando receber uma mensagem

echo "🧪 Testando webhook local..."
echo ""

curl -X POST http://localhost:3000/webhook/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "766760953108037",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15550000000",
            "phone_number_id": "927636830437279"
          },
          "contacts": [{
            "profile": {
              "name": "José"
            },
            "wa_id": "558888562749"
          }],
          "messages": [{
            "from": "558888562749",
            "id": "wamid.test123",
            "timestamp": "1234567890",
            "text": {
              "body": "clube da luta"
            },
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'

echo ""
echo ""
echo "✅ Teste concluído!"
