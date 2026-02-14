# Getting Started - Nexo AI

Guia rápido para começar a usar o Nexo AI em 5 minutos.

## Pré-requisitos

- **Node.js** v20+ (recomendado usar **Bun** para desenvolvimento)
- **PostgreSQL** (ou Supabase)
- **Conta Telegram** (para criar bot)
- **Conta Cloudflare** (opcional, para Workers AI)

---

## 1. Criar Bot Telegram

1. Abra o [@BotFather](https://t.me/botfather) no Telegram
2. Envie `/newbot`
3. Siga as instruções:
   - Escolha um nome (ex: "Nexo AI")
   - Escolha um username (ex: `@nexo_ai_bot`)
4. **Copie o token** gerado (algo como `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

> 💾 **Guarde este token** - você vai precisar dele!

---

## 2. Clonar e Instalar

```bash
# Clonar repositório
git clone https://github.com/psousaj/nexo-ai.git
cd nexo-ai

# Instalar dependências (recomendado: Bun)
bun install
```

**Se não tiver Bun:**

```bash
# Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Ou usar npm
npm install
```

---

## 3. Configurar Environment

```bash
# Copiar template
cp apps/api/.env.example apps/api/.env

# Editar com suas credenciais
nano apps/api/.env
```

### Variáveis Obrigatórias

```bash
# Database (PostgreSQL/Supabase)
DATABASE_URL="postgresql://user:password@host:5432/nexo_ai"

# Telegram Bot (do BotFather)
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"

# Telegram Webhook Secret (escolha uma string secreta)
TELEGRAM_WEBHOOK_SECRET="sua-chave-secreta-aqui"
```

### Variáveis Opcionais (Recomendadas)

```bash
# Cloudflare Workers AI (para embeddings)
CLOUDFLARE_ACCOUNT_ID="seu-account-id"
CLOUDFLARE_API_TOKEN="seu-api-token"

# Google Gemini (LLM principal)
GOOGLE_API_KEY="sua-api-key"

# APIs de Enriquecimento
TMDB_API_KEY="sua-tmdb-key"           # The Movie Database
YOUTUBE_API_KEY="sua-youtube-key"     # YouTube Data API

# Cache Redis (Opcional mas recomendado)
REDIS_HOST="redis-host"
REDIS_PORT=6379
REDIS_PASSWORD="redis-password"
REDIS_TLS=false
```

---

## 4. Setup Database

```bash
# Gerar migrations (Drizzle)
bun run db:generate

# Aplicar no banco
bun run db:push
```

**O que isso cria:**

- ✅ Tabela `users` - Usuários do bot
- ✅ Tabela `user_accounts` - Contas cross-provider (Telegram/WhatsApp)
- ✅ Tabela `memory_items` - Itens salvos (filmes, notas, etc)
- ✅ Tabela `conversations` - Estado de conversas
- ✅ Tabela `messages` - Histórico de mensagens

---

## 5. Testar Localmente

```bash
# Rodar servidor de desenvolvimento
bun run dev
```

**Servidor inicia em:** `http://localhost:3000`

**Verificar se está funcionando:**

```bash
# Health check
curl http://localhost:3000/health

# Deve retornar: {"status":"ok"}
```

---

## 6. Configurar Webhook Telegram

**Em desenvolvimento**, você pode usar **ngrok** para testar webhooks:

```bash
# Instalar ngrok
npm install -g ngrok

# Criar túnel para porta 3000
ngrok http 3000

# Copie a URL gerada (ex: https://abc123.ngrok.io)
```

**Configurar webhook no Telegram:**

```bash
# Substitua YOUR_BOT_TOKEN e YOUR_NGROK_URL
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<YOUR_NGROK_URL>/webhook/telegram",
    "secret_token": "sua-chave-secreta-aqui"
  }'
```

---

## 7. Primeira Interação

1. Abra o seu bot no Telegram
2. Envie qualquer mensagem (ex: `oi`)
3. Bot deve responder!

**Exemplos de mensagens:**

```
Você: "salva: clube da luta"
Bot: Encontrei 2 filmes:
     1. Fight Club (1999) - David Fincher ⭐ 8.8
     2. The Fight Club (2020)
     Qual você quer salvar?

Você: "1"
Bot: ✅ Fight Club (1999) salvo!
```

---

## 🎉 Próximos Passos

### Aprender Mais

- 📖 [Setup de Ambiente Completo](setup-environment.md) - Todas as variáveis explicadas
- 🏗️ [Visão Geral da Arquitetura](../concepts/architecture-overview.md) - Como o sistema funciona
- 📋 [Implementation Checklist](../reference/implementation-checklist.md) - Entender a refatoração v0.3.0

### Features Avançadas

- 🔍 [Busca Avançada](../how-to/advanced-search.md) - Filtros por ano, gênero, rating
- 🧠 [Busca Semântica](../how-to/semantic-search.md) - Embeddings e相似idade
- 🚀 [Deployment Cloudflare](../how-to/deployment-cloudflare.md) - Deploy em produção

---

## ❌ Troubleshooting

### Bot não responde

**Verifique:**

1. Webhook configurado corretamente?
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```

2. Servidor rodando?
   ```bash
   curl http://localhost:3000/health
   ```

3. Logs do servidor:
   ```bash
   bun run dev
   # Veja se há erros no console
   ```

### Erro de Database

```bash
# Testar conexão
psql $DATABASE_URL

# Re-aplicar migrations
bun run db:push
```

### TMDB/YouTube não funcionam

**Obter chaves de API:**

- [TMDB API Key](https://www.themoviedb.org/settings/api)
- [YouTube API Key](https://console.cloud.google.com/apis/credentials)

---

## 📚 Referências Úteis

- [Documentação OpenAPI](http://localhost:3000/reference) - Swagger UI
- [Drizzle Studio](http://localhost:4983) - Visualizar banco de dados
- [ADRs](../adr/README.md) - Decisões arquiteturais

---

**Última atualização**: 14 de fevereiro de 2026
