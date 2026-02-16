# Development Instructions

Essas instruções descrevem como rodar, desenvolver, migrar e testar o sistema completo usando pnpm + Hono + Drizzle + PostgreSQL, com IA opcional plug-and-play.

---

# 📌 1. Requisitos

- Node.js >= 20
- pnpm >= 9
- Docker (para Postgres)
- Chaves de API:
  - TMDB
  - YouTube Data API
  - IA (Claude/Gemini/OpenAI)

---

# ⚙️ 2. Subir infraestrutura local

```bash
docker compose up -d
```

Isso levanta:

- **Postgres**
- **Evolution API** (WhatsApp Server)

---

# 🏗️ 3. Instalar dependências

```bash
pnpm install
```

---

# 🧪 4. Drizzle: gerar e rodar migrations

```bash
pnpm exec drizzle-kit generate
pnpm exec drizzle-kit push
```

---

# 🟢 5. Rodar servidor dev

```bash
pnpm run dev
```

Endpoints úteis:

- `GET /health`
- `GET /docs` (Scalar UI)
- `POST /webhook/evolution`

---

# 🤖 6. Configure a IA usada (Claude, Gemini ou OpenAI)

No `.env`:

```
AI_PROVIDER=claude | gemini | openai
```

Depois:

```
CLAUDE_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

---

# 🔌 7. Habilitar MCP (opcional)

Para ativar:

```
ENABLE_MCP=true
```

O MCP expõe:

- Resources: leitura estruturada de items
- Tools: criação/busca/atualização
- Prompts: templates de classificação e enrichment

O backend funciona **normalmente mesmo sem MCP**.

---

# 📲 8. Webhook do WhatsApp (Evolution)

Configure o forwarding para:

```
POST https://SEU_DOMAIN/webhook/evolution
```

O handler:

- cria/recupera conversas,
- envia histórico para IA,
- executa tools,
- salva dados no DB,
- responde no WhatsApp.

---

# 🧹 9. Convenções de Código

- **services/** → Regras de negócio puras
- **routes/** → Entrada HTTP
- **db/** → Schemas + repositórios
- **conversation/** → Orquestração de IA
- **ai/** → Adaptadores de modelo
- **enrichment/** → TMDB/YouTube/OG

---

# 🧪 10. Tests

### Unit

```bash
pnpm test -- --filter unit
```

### Integration

Requer Docker:

```bash
pnpm test -- --filter integration
```

### E2E

```bash
pnpm test -- --filter e2e
```

---

# 🛠️ 11. Guidelines de IA (para desenvolvimento)

A IA deve **sempre**:

1. Verificar inconsistências nos pedidos.
2. Verificar se existe solução pronta antes de reinventar a roda.
3. Perguntar antes de implementar algo complexo sem necessidade.
4. Perguntar quando houver redundância ou perfumaria desnecessária.
5. Confirmar decisões arquiteturais antes de gerar código.

---

# 📦 12. Build para produção

```bash
pnpm run build
```

---

# 🚀 13. Deploy

Pode ser feito em:

- **Railway**
- **Fly.io**
- **Render**
- **Docker + VPS**
- **Cloudflare Workers / Functions** (modo serverless, sem MCP)

---

# 🔚 Fim

Se quiser, posso gerar agora:

- `CONTRIBUTING.md`
- `STRUCTURE.md`
- `DEV_GUIDE.md`
