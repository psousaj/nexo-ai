# Arquitetura - Nexo AI

Visão geral da arquitetura do assistente pessoal WhatsApp.

## Visão Geral

```
WhatsApp (Meta API)
    ↓ Webhook
REST Adapter (Cloudflare Worker)
    ↓
Services Layer
    ├── Conversation Manager
    ├── AI Service (Claude)
    ├── Enrichment Service
    └── Item Service
    ↓
PostgreSQL (Supabase)
```

## Princípios

- **Adapters são simples**: apenas traduzem requisições
- **Services contêm lógica**: toda regra de negócio fica nos services
- **Contexto no backend**: não dependemos de memória do LLM
- **AI-agnostic**: funciona com qualquer LLM (ver [ADR-005](adr/005-ai-agnostic.md))

> **Decisões Arquiteturais**: Ver [ADRs](adr/README.md) para contexto detalhado das escolhas técnicas

## Camadas

### 1. Adapters

Responsáveis por comunicação externa, sem lógica de negócio.

**REST Adapter** (MVP):

- Recebe webhooks do WhatsApp
- Expõe API REST para UI futura
- Valida payloads e mapeia respostas

**MCP Adapter** (futuro):

- Expõe tools/resources MCP
- Mapeia para os mesmos services

### 2. Services

Toda a lógica da aplicação.

**conversation-service**:

- `getOrCreateConversation(userId, chatId)`
- `addMessage(conversationId, role, content)`
- `getHistory(conversationId, limit)`
- `updateState(conversationId, state, context)`

**item-service**:

- `createItem(userId, payload)`
- `updateItem(id, patch)`
- `searchItems(filters)`
- `deleteItem(id)`

**classifier-service**:

- `detectType(message | url)` → tipo de conteúdo
- `extractEntities(message)` → extrai título, ano, etc

**enrichment-service**:

- `enrichMovieByTitle(title)` → metadados TMDB
- `enrichYoutubeVideo(url)` → metadados YouTube
- `enrichLink(url)` → OpenGraph

**ai-service**:

- `callLLMWithContext({ message, history, context })`
- Provider-agnostic

### 3. Database

PostgreSQL com JSONB para metadados flexíveis.

Tabelas principais:

- `users` - Usuários do sistema
- `items` - Conteúdo salvo
- `conversations` - Contexto de conversas
- `messages` - Histórico de mensagens

## State Machine de Conversação

Mantém a experiência previsível:

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

Estados:

- **idle**: nenhuma operação pendente
- **awaiting_confirmation**: aguarda resposta do usuário
- **enriching**: buscando metadados externos
- **saving**: gravando no banco
- **error**: tratamento de erro, volta para idle

## Fluxo Completo (Exemplo)

### 1. Recepção de Mensagem

```
WhatsApp → Webhook → REST Adapter → Conversation Service
```

### 2. Processamento com AI

```
Conversation Service → AI Service → Claude API
       ↓
  (com histórico + contexto)
```

### 3. Enrichment

```
AI detecta tipo → Classifier → Enrichment Service → APIs Externas
                                      ↓
                                  (TMDB/YouTube/OG)
```

### 4. Salvamento

```
Enrichment completo → Item Service → PostgreSQL → Resposta para WhatsApp
```

## Exemplo Concreto: Salvar Filme

**1. Usuário envia**: "clube da luta"

**2. Webhook recebe** `POST /webhook/meta`:

```json
{
  "from": "5585999999999",
  "body": "clube da luta"
}
```

**3. Conversation Manager**:

- Busca ou cria conversação
- Adiciona mensagem do usuário ao histórico

**4. AI Service**:

- Monta prompt com contexto
- Chama Claude API
- Claude identifica: provável filme

**5. Classifier + Enrichment**:

- `detectType("clube da luta")` → "movie"
- `enrichMovieByTitle("clube da luta")` → busca TMDB
- Retorna múltiplos resultados

**6. AI responde ao usuário**:

```
Encontrei 2 filmes:
1. Fight Club (1999) - David Fincher
2. Fight Club (2011) - outro

Qual você quer salvar?
```

**7. Usuário responde**: "o primeiro"

**8. State machine** avança: `awaiting_confirmation` → `saving`

**9. Item Service**:

- Cria item com metadata completo
- Status: "pending"

**10. Resposta final**:

```
✅ Salvei "Fight Club" (1999)
Disponível em: Netflix, Amazon Prime
IMDb: 8.8/10
```

## MCP Integration (Futuro)

Quando usar Claude + MCP:

### Resources

- `items://user/{userId}` - lista items
- `items://user/{userId}/type/{type}` - items filtrados

### Tools

- `save_item` → `item-service.createItem()`
- `search_items` → `item-service.searchItems()`
- `update_item_status` → `item-service.updateItem()`

### Prompts

- `categorize_item` - template classificação
- `enrich_metadata` - template enrichment

**Importante**: MCP é opcional e não muda os services existentes.

## Benefícios da Arquitetura

- ✅ Desacoplada: trocar LLM não afeta services
- ✅ Testável: services podem ser testados isoladamente
- ✅ Escalável: cada camada pode escalar independentemente
- ✅ Serverless-ready: funciona em Cloudflare Workers
- ✅ Manutenível: responsabilidades claras

## Limitações Cloudflare Workers

- CPU time: max 50ms (free) / 30s (paid)
- Memory: 128MB
- Request size: 100MB

**Otimizações**:

- Cache responses quando possível
- Use `waitUntil()` para operações assíncronas
- Minimize bundle size
