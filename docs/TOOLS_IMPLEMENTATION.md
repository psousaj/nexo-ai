# Implementação de AI Tools (Function Calling)

## Visão Geral

Implementação completa do sistema de **function calling** para o NEXO, permitindo que a IA execute ações específicas através de tools.

## Arquivos Criados/Modificados

### 1. Tools Definitions (`src/services/ai/tools.ts`)

Define as 5 tools disponíveis para a IA:

- **save_item**: Salva filmes, vídeos, links ou notas
- **search_items**: Busca itens salvos do usuário
- **enrich_metadata**: Busca metadados de filmes/vídeos
- **apply_user_timeout**: Aplica timeout de 5 minutos para usuários ofensivos
- **get_streaming_providers**: Consulta onde um filme está disponível para streaming

### 2. Tool Executor (`src/services/ai/tool-executor.ts`)

Classe responsável por executar as tool calls da IA:

```typescript
const toolExecutor = new ToolExecutor({
  userId: user.id,
  externalId: incomingMsg.externalId,
  conversationId: conversation.id,
});

const results = await toolExecutor.executeCalls(toolCalls);
```

**Features:**
- Contexto isolado por usuário/conversação
- Tratamento de erros por tool
- Logs detalhados de execução
- Importação dinâmica para evitar dependências circulares

### 3. TMDB Streaming Providers

**Método:** `getStreamingProviders(tmdbId: number)`

Retorna informações sobre onde o filme está disponível:

```typescript
{
  success: true,
  available_on_streaming: true,
  needs_download: false,
  providers: [
    {
      name: "Netflix",
      type: "flatrate", // "rent" | "buy"
      logo: "/path/to/logo.jpg"
    }
  ],
  message: "Disponível em: Netflix, Prime Video"
}
```

**Região:** Brasil (BR)

### 4. Item Service Enhancement

Novo método `getUserItems()` para buscar items do usuário com filtros:

```typescript
await itemService.getUserItems(
  userId,
  query?,      // busca por título
  type?,       // filtra por tipo
  limit = 10   // limite de resultados
);
```

### 5. AI Response Type Update

Adicionado suporte a `tool_calls` no tipo `AIResponse`:

```typescript
export interface AIResponse {
  message: string;
  action?: "save_item" | "search_items" | "enrich_metadata";
  data?: any;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}
```

### 6. Webhook Integration

Processamento automático de tool calls no webhook:

```typescript
if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
  const toolExecutor = new ToolExecutor({...});
  const toolCalls = aiResponse.tool_calls.map(tc => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments)
  }));
  
  const results = await toolExecutor.executeCalls(toolCalls);
}
```

### 7. User Timeouts Export

Exportado `userTimeouts` do webhook para permitir acesso via tool:

```typescript
export const userTimeouts = new Map<string, number>();
```

## Tools Disponíveis

### 1. save_item

**Parâmetros:**
- `type`: "movie" | "video" | "link" | "note"
- `title`: string
- `metadata?`: objeto com metadados

**Uso:** Quando o usuário quer salvar algo

### 2. search_items

**Parâmetros:**
- `query?`: string (busca por título)
- `type?`: "movie" | "video" | "link" | "note" | "all"
- `limit?`: number (default: 10)

**Uso:** Quando o usuário quer buscar/listar seus itens salvos

### 3. enrich_metadata

**Parâmetros:**
- `type`: "movie" | "video"
- `query`: string (nome do filme ou URL do vídeo)

**Uso:** Buscar informações detalhadas sobre filmes/vídeos

### 4. apply_user_timeout

**Parâmetros:**
- `reason`: string (motivo do timeout)

**Uso:** Aplicar timeout de 5 minutos quando usuário for ofensivo

**Nota:** Integrado com o sistema de detecção de ofensas existente

### 5. get_streaming_providers

**Parâmetros:**
- `tmdbId`: number (ID do filme no TMDB)

**Retorno:**
```typescript
{
  success: true,
  available_on_streaming: boolean,
  needs_download: boolean,
  providers: Array<{
    name: string,
    type: "flatrate" | "rent" | "buy",
    logo: string
  }>,
  message: string
}
```

**Uso:** Informar ao usuário onde o filme está disponível

**Exemplo de resposta:**
- ✅ Disponível na Netflix
- ✅ Disponível no Prime Video (aluguel)
- ❌ Não disponível em streaming, precisa baixar via torrent/Radarr

## Fluxo de Execução

1. **Usuário envia mensagem**
2. **IA processa** e decide se precisa usar tools
3. **IA retorna** resposta com `tool_calls[]`
4. **Webhook detecta** tool calls
5. **ToolExecutor** executa cada tool
6. **Resultados** são logados (futuramente podem ser enviados de volta à IA)
7. **Resposta final** é enviada ao usuário

## Logs

Exemplo de logs durante execução de tools:

```
🧠 Chamando IA...
💬 Resposta da IA: Vou buscar seus filmes salvos...
🔧 Processando 1 tool call(s)...
🔧 Executando tool: search_items
📋 Args: {"query":"matrix","type":"movie","limit":5}
✅ Tool search_items executada com sucesso
✅ Tool calls executadas: 1
  ✅ call_123: {"success":true,"count":2,"items":[...]}
```

## Próximos Passos

- [ ] Enviar resultados das tools de volta para a IA (segunda chamada)
- [ ] Implementar tools para Radarr/torrent
- [ ] Adicionar tool para download automático quando filme não está em streaming
- [ ] Implementar cache de streaming providers
- [ ] Adicionar tool para gerenciar watchlist

## Referências

- Roadmap Steps: 3.7 (Tool Definitions), 3.8 (Tool Execution), 3.9 (Environment Config)
- ADR: 005-ai-agnostic.md
- TMDB Watch Providers API: https://developers.themoviedb.org/3/movies/get-movie-watch-providers
