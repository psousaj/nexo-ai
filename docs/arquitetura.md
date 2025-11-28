Arquitetura de Dados
Schema PostgreSQL (conceitual)
┌─────────────────────────────────────────────────────────────┐
│ items │
├─────────────────────────────────────────────────────────────┤
│ id: uuid (PK) │
│ user_id: text (FK) - WhatsApp number ou Auth.js user_id │
│ type: text - 'movie' | 'video' | 'link' | 'note' | etc │
│ title: text │
│ description: text? │
│ metadata: jsonb - estrutura varia por tipo │
│ tags: jsonb (array) - ['terror', 'ação'] │
│ status: text - 'pending' | 'watched' | 'completed' │
│ created_at: timestamp │
│ updated_at: timestamp │
│ │
│ Indexes: │
│ - GIN(metadata) - queries em JSONB │
│ - GIN(tags) - busca por tags │
│ - (user_id, type) - filtros comuns │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ conversations │
├─────────────────────────────────────────────────────────────┤
│ id: uuid (PK) │
│ user_id: text (FK) │
│ whatsapp_chat_id: text - ID do chat no WhatsApp │
│ state: text - estado atual da conversa │
│ context: jsonb - dados temporários da conversa │
│ last_message_at: timestamp │
│ created_at: timestamp │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ messages │
├─────────────────────────────────────────────────────────────┤
│ id: uuid (PK) │
│ conversation_id: uuid (FK) │
│ role: text - 'user' | 'assistant' │
│ content: text │
│ metadata: jsonb - tool_calls, attachments, etc │
│ created_at: timestamp │
└─────────────────────────────────────────────────────────────┘
Exemplos de metadata por tipo
typescript// movie
{
tmdb_id: 550,
year: 1999,
genres: ['Drama', 'Thriller'],
director: 'David Fincher',
rating: 8.8,
runtime: 139,
poster_url: 'https://...',
streaming: [
{ provider: 'Netflix', url: 'https://...', type: 'subscription' },
{ provider: 'Amazon', url: 'https://...', type: 'rent', price: 3.99 }
],
download_available: false
}

// video (YouTube)
{
video_id: 'dQw4w9WgXcQ',
channel: 'Rick Astley',
channel_id: 'UC...',
duration: 212,
views: 1000000000,
published_at: '2009-10-25',
thumbnail_url: 'https://...',
category: 'Music'
}

// link
{
url: 'https://react.dev',
domain: 'react.dev',
og_title: 'React',
og_description: 'The library for web and native user interfaces',
og_image: 'https://...',
og_type: 'website'
}

// note (texto puro, sem enrichment)
{
content: 'Lembrar de estudar hooks do React',
category: 'study' // inferido pelo Claude
}

```

## Fluxo de Funcionamento

### 1. Recepção de Mensagem (WhatsApp → Backend)
```

┌─────────────┐ ┌──────────────┐ ┌─────────────────┐
│ WhatsApp │ webhook │ Fastify │ │ ConversationMgr │
│ ├────────>│ /webhook/ ├────────>│ │
│ │ │ evolution │ │ getOrCreate() │
└─────────────┘ └──────────────┘ └─────────────────┘

```

### 2. Processamento com Claude AI
```

┌─────────────────┐ ┌──────────────┐ ┌─────────────┐
│ MessageHandler │────>│ Claude API │────>│ Tool Calls │
│ │ │ + Tools │ │ │
│ - Contexto │ │ │ │ - save_item │
│ - Histórico │ │ │ │ - search │
└─────────────────┘ └──────────────┘ └─────────────┘

```

### 3. Enrichment de Metadados
```

┌──────────────┐ ┌─────────────────────────────┐
│ Classifier │───>│ Enrichment Service │
│ │ │ │
│ detectType() │ │ ┌─────────┐ ┌─────────┐ │
└──────────────┘ │ │ TMDB │ │ YouTube │ │
│ │ │ │ │ │
│ └─────────┘ └─────────┘ │
│ ┌───────────┐ │
│ │ OpenGraph │ │
│ └───────────┘ │
└─────────────────────────────┘

```

### 4. Salvamento e Resposta
```

┌────────────┐ ┌──────────┐ ┌──────────────┐
│ Repository │─────>│ Postgres │ │ Evolution API│
│ │ │ │ │ │
│ create() │ │ INSERT │ │ sendMessage()│
└────────────┘ └──────────┘ └──────────────┘
│
▼
┌──────────┐
│ WhatsApp │
└──────────┘

```

## Exemplo de Fluxo Completo

### Cenário: Salvar filme
```

[Usuário no WhatsApp]
"os sete escolhidos"

[Webhook recebe]
POST /webhook/evolution
{
"from": "5585999999999",
"body": "os sete escolhidos",
"messageId": "..."
}

[MessageHandler]

1. Busca/cria conversation
2. Adiciona mensagem ao histórico
3. Chama Claude API com tools disponíveis

[Claude API]

- Detecta que é provável filme
- Chama tool: search_items(query: "os sete escolhidos", type: "movie")
- Backend executa: TMDBService.searchMovie("os sete escolhidos")
- Retorna múltiplos resultados ao Claude

[Claude responde]
"Achei 2 filmes:

1. Seven Samurai (1954) - Akira Kurosawa
2. The Magnificent Seven (2016) - Antoine Fuqua

Qual deles você quer salvar?"

[Evolution API envia resposta]

[Usuário responde]
"o de 2016"

[Novo ciclo]

- Claude entende a escolha
- Chama tool: save_item({
  type: "movie",
  title: "The Magnificent Seven",
  tmdb_id: 333484
  })
- Backend:
  1. Chama TMDBService.getMovieDetails(333484)
  2. Chama TMDBService.getStreamingProviders(333484)
  3. Salva no DB com metadata completo
- Claude confirma: "✅ Salvei 'The Magnificent Seven' (2016).
  Disponível na Netflix e Amazon Prime!"

```

## MCP Server Integration

O MCP Server roda integrado ao Fastify e expõe:

### Resources
- `items://user/{userId}` - Lista todos os items do usuário
- `items://user/{userId}/type/{type}` - Items filtrados por tipo

### Tools
- `save_item` - Salva novo item
- `search_items` - Busca com filtros avançados
- `update_item_status` - Marca como assistido/concluído
- `get_streaming_availability` - Verifica onde assistir

### Prompts
- `categorize_item` - Template para classificar items ambíguos
- `enrich_metadata` - Template para buscar dados complementares

## API REST (OpenAPI)

Documentação interativa via Scalar em `/docs`

### Principais endpoints
```

GET /health
GET /docs # Scalar UI

POST /webhook/evolution # Recebe mensagens WhatsApp

GET /items # Lista items (filtros: type, tags, status)
GET /items/:id # Detalhes do item
POST /items # Cria item manualmente
PATCH /items/:id # Atualiza item
DELETE /items/:id # Deleta item

POST /items/search # Busca avançada
GET /items/stats # Estatísticas (total por tipo, etc)

GET /auth/\* # Auth.js routes
