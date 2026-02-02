# Arquitetura

## Diagrama de Fluxo

```
WhatsApp (Meta API)
    ↓
Webhook → Conversation Manager (State Machine)
              ↓
          AI Service (Claude) + Tools
              ↓
          Enrichment (TMDB/YouTube/OG)
              ↓
          PostgreSQL (Supabase)
```

## Camadas

### 1. Adapters (REST/MCP)

Traduzem requisições externas:

- `routes/webhook/meta.ts` - WhatsApp webhook
- `routes/items/` - CRUD REST
- MCP server (futuro)

### 2. Services (Lógica de Negócio)

- `conversation-service` - State machine de conversação
- `ai-service` - Interface com LLM (provider-agnostic)
- `enrichment-service` - TMDB, YouTube, OpenGraph
- `item-service` - CRUD de items
- `classifier-service` - Detecção de tipo de conteúdo

### 3. Database (PostgreSQL + Supabase)

- `users` - Usuários WhatsApp
- `items` - Conteúdo salvo (metadata JSONB)
- `conversations` - Estado de conversas
- `messages` - Histórico de mensagens

## State Machine

Estados da conversação:

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

**Por quê?** Ver [ADR-004](adr/004-state-machine.md)

## Princípios Arquiteturais

- **Adapters são simples**: apenas traduzem requisições
- **Services são provider-agnostic**: podem trocar LLM/APIs sem quebrar
- **JSONB para flexibilidade**: metadados diferentes por tipo de item
- **State persistido**: conversação sobrevive a cold starts

Ver todos os ADRs em [adr/](adr/README.md)

## Exemplo de Fluxo

```
1. Usuário: "clube da luta"
   → Webhook recebe mensagem
   → conversation-service carrega estado (idle)

2. Bot classifica
   → classifier-service detecta: "movie"
   → enrichment-service busca TMDB
   → Retorna múltiplos resultados

3. Bot: "Encontrei 2 filmes:
         1. Fight Club (1999) - David Fincher ⭐ 8.8
         2. The Fight Club (2020)
         Qual você quer salvar?"
   → Estado muda para: awaiting_confirmation
   → context salva: { candidates: [...], awaiting_selection: true }

4. Usuário: "1"
   → conversation-service carrega context
   → AI confirma seleção
   → item-service.createItem()

5. Bot: "✅ Fight Club (1999)
         Netflix, Amazon Prime"
   → Estado volta para: idle
   → context limpo
```
