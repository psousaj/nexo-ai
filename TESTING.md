# Como Testar

## ⚙️ Configuração Inicial

### 1. Environment Variables

Crie `.env` com as seguintes chaves:

```bash
# Obrigatório para IA funcionar
ANTHROPIC_API_KEY=sk-ant-xxx  # https://console.anthropic.com/settings/keys

# Obrigatório para WhatsApp
META_WHATSAPP_TOKEN=xxx
META_WHATSAPP_PHONE_NUMBER_ID=xxx
META_VERIFY_TOKEN=xxx

# Database
DATABASE_URL=xxx
```

### 2. Lista Permitida WhatsApp (Dev Mode)

No modo de desenvolvimento, você só pode enviar mensagens para números verificados:

1. Acesse [Facebook Developers](https://developers.facebook.com/apps)
2. Selecione seu App > **WhatsApp** > **Configuration**
3. Em **"Phone numbers"**, adicione o número destino
4. Verifique com código SMS

⚠️ **Erro comum**: `131030 - Recipient phone number not in allowed list`

---

## 🚀 Iniciar Servidor

```bash
bun run dev
```

Servidor disponível em: http://localhost:3000  
Swagger/Docs: http://localhost:3000/swagger

---

## 📱 Testar WhatsApp API

### 1. Enviar Mensagem (Meta → Usuário)

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/SEU_PHONE_NUMBER_ID/messages \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5588988562749",
    "type": "text",
    "text": {
      "body": "Olá! Teste de mensagem."
    }
  }'
```

### 2. Testar Webhook Local (Usuário → Bot)

**Automático:**

```bash
./test-local-webhook.sh
```

**Manual:**

```bash
curl -X POST http://localhost:3000/webhook/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15550000000",
            "phone_number_id": "123"
          },
          "messages": [{
            "from": "558888562749",
            "id": "msg_123",
            "timestamp": "1234567890",
            "text": { "body": "clube da luta" },
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

---

## 🌐 Expor para Meta (Receber Webhooks Reais)

### 1. Instalar ngrok

```bash
# macOS/Linux
brew install ngrok

# Ou baixar de https://ngrok.com
```

### 2. Expor servidor local

```bash
ngrok http 3000
```

Copia a URL pública (ex: `https://abc123.ngrok.io`)

### 3. Configurar no Meta Developer Portal

1. Acesse: https://developers.facebook.com/apps
2. Vá em **WhatsApp > Configuration**
3. Configure Callback URL: `https://abc123.ngrok.io/webhook/meta`
4. Verify Token: valor do `META_VERIFY_TOKEN` do seu `.env`
5. Subscribe to: `messages`
6. Clique em **Verify and Save**

### 4. Testar via WhatsApp

Envie uma mensagem para o número de teste do WhatsApp Business e veja a mágica acontecer! ✨

---

## 🧪 Testar Outras Rotas

### Health Check

```bash
curl http://localhost:3000/health
```

### Listar Items

```bash
curl "http://localhost:3000/items?userId=uuid-do-usuario&limit=10"
```

### Buscar Item

```bash
curl "http://localhost:3000/items/uuid-do-item?userId=uuid-do-usuario"
```

### Busca Semântica

```bash
curl -X POST http://localhost:3000/items/search \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid-do-usuario",
    "query": "terror",
    "limit": 5
  }'
```

### Deletar Item

```bash
curl -X DELETE "http://localhost:3000/items/uuid-do-item?userId=uuid-do-usuario"
```

---

## 📊 Swagger UI

Acesse http://localhost:3000/swagger para testar todas as rotas visualmente! 🎯
