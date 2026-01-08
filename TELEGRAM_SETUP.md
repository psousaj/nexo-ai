# Setup Rápido - Telegram Bot

## 1. Criar Bot no Telegram

1. Abra o Telegram e busque por **@BotFather**
2. Envie `/newbot`
3. Escolha um nome: **Nexo AI**
4. Escolha um username: **nexoai_bot** (deve terminar com `_bot`)
5. Copie o **token** que o BotFather enviar (formato: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

## 2. Configurar Token no .env

Edite o arquivo `.env` e substitua:

```bash
TELEGRAM_BOT_TOKEN=seu_token_aqui
```

Por:

```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

## 3. Instalar Dependências

```bash
bun install
```

## 4. Executar Migrations (se ainda não fez)

```bash
bun run db:push
```

## 5. Iniciar Servidor

```bash
bun run dev
```

O servidor vai iniciar em `http://localhost:3000`

## 6. Testar Localmente (Opcional)

Em outro terminal:

```bash
./test-telegram.sh "clube da luta"
```

## 7. Configurar Webhook (Produção)

Para receber mensagens do Telegram em produção:

### Opção A: ngrok (desenvolvimento)

```bash
# Instale ngrok: https://ngrok.com/download
ngrok http 3000

# Copie a URL (ex: https://abc123.ngrok.io)
# Configure webhook:
curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook" \
  -d "url=https://abc123.ngrok.io/webhook/telegram" \
  -d "secret_token=meu_secret_opcional"
```

### Opção B: Deploy Cloudflare Workers

```bash
# Configure secrets
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put GOOGLE_API_KEY
wrangler secret put DATABASE_URL

# Deploy
wrangler deploy

# Configure webhook
curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook" \
  -d "url=https://nexo-ai.your-subdomain.workers.dev/webhook/telegram" \
  -d "secret_token=meu_secret_opcional"
```

## 8. Testar no Telegram

1. Busque seu bot no Telegram: **@nexoai_bot**
2. Envie `/start`
3. Envie uma mensagem: **"clube da luta"**
4. O bot deve responder com opções de filmes encontrados

## Troubleshooting

### Erro: "TELEGRAM_BOT_TOKEN is required"

- Certifique-se de que o token está no `.env`
- Reinicie o servidor

### Erro: "Database connection failed"

- Verifique `DATABASE_URL` no `.env`
- Teste a conexão: `bun run db:studio`

### Bot não responde no Telegram

- Verifique se o webhook está configurado:

  ```bash
  curl "https://api.telegram.org/bot<SEU_TOKEN>/getWebhookInfo"
  ```

- Verifique logs do servidor
- Certifique-se de que a URL é acessível externamente (não `localhost`)

### Erro 403 Forbidden

- Verifique `TELEGRAM_WEBHOOK_SECRET` no `.env`
- Deve corresponder ao `secret_token` configurado no webhook

## Comandos Úteis

```bash
# Ver informações do bot
curl "https://api.telegram.org/bot<SEU_TOKEN>/getMe"

# Ver webhook configurado
curl "https://api.telegram.org/bot<SEU_TOKEN>/getWebhookInfo"

# Remover webhook (para testes locais)
curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/deleteWebhook"

# Logs em tempo real (produção)
wrangler tail
```

## Próximos Passos

Após teste local funcionar:

1. Deploy em produção (Cloudflare Workers)
2. Configure webhook apontando para produção
3. Teste com usuários reais
4. Implemente features avançadas (ver `docs/roadmap.md`)
