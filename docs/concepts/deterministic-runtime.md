# Refatoração v0.3.0 - Arquitetura Determinística

**Data**: 2025-01-08  
**Status**: ✅ Completo

## Visão Geral

Esta refatoração implementa **controle runtime determinístico completo** seguindo o pattern Hugging Face Agents, onde:

- **LLM = planner + writer** (apenas retorna JSON estruturado)
- **Runtime = executor** (toma todas decisões de fluxo)
- **Tools = contratos fortes** (cada tool específica, sem genéricos)

## Mudanças Principais

### 1. Schema Canônico de Resposta do Agente

**Antes**: LLM retornava texto livre ou JSON inconsistente

**Depois**: `AgentLLMResponse` - schema único e validado

```typescript
interface AgentLLMResponse {
	action: 'CALL_TOOL' | 'RESPOND' | 'NOOP';
	tool?: ToolName; // obrigatório se action=CALL_TOOL
	args?: Record<string, any>;
	message?: string | null; // null se action=NOOP
}
```

**Regras de validação**:

- `action=CALL_TOOL` → `tool` é obrigatório
- `action=NOOP` → `message` deve ser `null`
- `action=RESPOND` → `message` contém resposta ao usuário

**Arquivo**: [src/types/index.ts](../src/types/index.ts)

### 2. Tools com Contratos Fortes

**Antes**: 7 tools genéricas (`save_memory`, `search_memory`, `enrich_content`, `list_memories`, `respond`)

**Depois**: 11 tools específicas

#### Save Tools (5 específicas)

```typescript
save_note(content: string)
save_movie(title: string, year?: number, tmdb_id?: number)
save_tv_show(title: string, year?: number, tmdb_id?: number)
save_video(url: string, title?: string)
save_link(url: string, description?: string)
```

#### Enrichment Tools (3)

```typescript
enrich_movie(title: string, year?: number)
enrich_tv_show(title: string, year?: number)
enrich_video(url: string)
```

#### Search Tool (1)

```typescript
search_items(query?: string, limit?: number)  // sem query = lista tudo
```

#### Delete Tools (2 - determinísticas)

```typescript
delete_memory(item_id: string)
delete_all_memories()  // não passa pela LLM
```

**Arquivo**: [src/services/tools/index.ts](../src/services/tools/index.ts)

### 3. Eliminação de Lógica de Oferta da LLM

**Removido**:

- ❌ `CHAT_SYSTEM_PROMPT` (conversação livre)
- ❌ `OFFER_SAVE_NOTE_PROMPT` (LLM perguntando "quer que eu salve?")
- ❌ `OFFER_SAVE_NOTE_SYSTEM`
- ❌ `INTENT_ROUTER_PROMPT` (LLM decidindo intent)
- ❌ `STRICT_JSON_PROMPT`
- ❌ Tool `respond()` (wrapper de resposta)

**Mantido**:

- ✅ `AGENT_SYSTEM_PROMPT` (apenas JSON planner+writer)
- ✅ Respostas determinísticas (`GENERIC_CONFIRMATION`, `NO_ITEMS_FOUND`, `CASUAL_GREETINGS`)
- ✅ Helpers (`formatItemsList()`)

**Arquivo**: [src/config/prompts.ts](../src/config/prompts.ts)

### 4. Novo AGENT_SYSTEM_PROMPT

**Características**:

- Instrução explícita: "SEMPRE responda em JSON válido"
- Lista completa de todas as 11 tools com assinaturas
- Exemplos JSON para cada tipo de ação:
  - `CALL_TOOL` (enrich_movie)
  - `RESPOND` (resposta ao usuário)
  - `NOOP` (nada a fazer)
- Regras claras:
  - Sem conversação
  - Sem oferecer confirmações
  - Sem emojis ou small talk

**Exemplo de prompt**:

```typescript
export const AGENT_SYSTEM_PROMPT = `
Você é um assistente que SEMPRE responde em JSON válido seguindo este schema:

{
  "action": "CALL_TOOL" | "RESPOND" | "NOOP",
  "tool": string (se action=CALL_TOOL),
  "args": object (se action=CALL_TOOL),
  "message": string | null
}

TOOLS DISPONÍVEIS:
- save_note(content: string)
- save_movie(title: string, year?: number, tmdb_id?: number)
- enrich_movie(title: string, year?: number)
...

EXEMPLOS:

1. Usuário: "salva inception"
{
  "action": "CALL_TOOL",
  "tool": "enrich_movie",
  "args": {"title": "inception"},
  "message": null
}

2. Se enriquecimento retorna múltiplos:
{
  "action": "RESPOND",
  "message": "Encontrei 2 filmes:\n1. Inception (2010)...",
  "tool": null,
  "args": null
}

REGRAS:
- NÃO pergunte "quer que eu salve?"
- NÃO use emojis ou small talk
- Apenas JSON puro
`;
```

## Fluxo de Execução (Exemplo)

### Caso 1: "salva inception"

```
1. Webhook recebe mensagem
   ↓
2. Intent Classifier detecta: {intent: 'save', action: 'save', entities: {content: 'inception'}}
   ↓
3. Agent Orchestrator → handleWithLLM()
   ↓
4. LLM retorna JSON:
   {
     "action": "CALL_TOOL",
     "tool": "enrich_movie",
     "args": {"title": "inception"}
   }
   ↓
5. executeTool(enrich_movie, {title: "inception"})
   → Busca TMDB → Retorna 2 resultados
   ↓
6. Runtime decide: múltiplos resultados → pedir confirmação ao usuário
   ↓
7. LLM retorna JSON:
   {
     "action": "RESPOND",
     "message": "Encontrei 2 filmes:\n1. Inception (2010) - Nolan\n2. Inception (2014)\nQual você quer?"
   }
   ↓
8. Runtime envia mensagem e salva pendingAction no contexto
```

### Caso 2: "deleta tudo" (determinístico)

```
1. Intent Classifier detecta: {action: 'delete_all'}
   ↓
2. Agent Orchestrator → handleDeleteAll()
   ↓
3. executeTool(delete_all_memories) diretamente
   ↓
4. Retorna resposta determinística: "✅ Tudo deletado"
   (LLM NÃO É CHAMADA)
```

## Intent Classifier (Determinístico)

**Não mudou** - continua retornando `action` que dirige o fluxo:

```typescript
interface IntentResult {
	intent: Intent;
	action: ActionVerb; // delete_all, list_all, save, search, etc
	confidence: number;
	entities: {
		content?: string;
		item_id?: string;
		query?: string;
	};
}
```

**Ações determinísticas** (sem LLM):

- `delete_all` → executa diretamente
- `list_all` → executa diretamente
- `cancel` → limpa contexto

**Ações com LLM** (planner mode):

- `save` → LLM decide qual tool (enrich_movie, save_note, etc)
- `search` → LLM decide parâmetros (query, limit)
- `save_previous` → LLM extrai contexto da mensagem anterior

## Validação de Resposta

Função `validateAgentResponse()` garante schema correto:

```typescript
function validateAgentResponse(response: any): response is AgentLLMResponse {
	if (response.action === 'CALL_TOOL' && !response.tool) {
		throw new Error('action=CALL_TOOL requer tool');
	}
	if (response.action === 'NOOP' && response.message !== null) {
		throw new Error('action=NOOP requer message=null');
	}
	return true;
}
```

## Benefícios

### 1. Controle Runtime

- **Antes**: LLM decidia tudo (quando oferecer, quando salvar)
- **Depois**: Runtime decide fluxo, LLM apenas planeja

### 2. Previsibilidade

- **Antes**: Respostas variavam ("quer que eu salve?" vs "salvei!")
- **Depois**: Fluxo fixo, respostas consistentes

### 3. Testabilidade

- **Antes**: Difícil testar comportamento conversacional
- **Depois**: Cada tool isolada, JSON validado

### 4. Debugging

- **Antes**: "Por que a LLM decidiu X?"
- **Depois**: Logs claros: action → tool → result

### 5. Custo

- **Antes**: LLM chamada para qualquer coisa
- **Depois**: Ações determinísticas pulam LLM

## Arquivos Modificados

| Arquivo                              | Mudança                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `src/types/index.ts`                 | Adicionou `AgentLLMResponse`, `AgentAction`, `ToolName`, `validateAgentResponse()` |
| `src/services/tools/index.ts`        | Refatorou 7 tools → 11 tools específicas                                           |
| `src/config/prompts.ts`              | Reescreveu `AGENT_SYSTEM_PROMPT`, removeu `CHAT_SYSTEM_PROMPT`                     |
| `src/services/agent-orchestrator.ts` | _(próximo passo)_ Adaptar para JSON schema                                         |
| `src/services/ai/types.ts`           | _(próximo passo)_ Adaptar tipos                                                    |

## Próximos Passos

### 1. Atualizar Agent Orchestrator

- [ ] Parsear `AgentLLMResponse` em `handleWithLLM()`
- [ ] Implementar lógica `pendingAction` para confirmações
- [ ] Adicionar retry logic para JSON inválido

### 2. Atualizar AI Service

- [ ] Validar resposta com `validateAgentResponse()`
- [ ] Adicionar fallback se JSON inválido

### 3. Testes

- [ ] Unit tests para cada tool
- [ ] Integration test: JSON schema parsing
- [ ] E2E test: "salva inception" → enrich → confirm → save

### 4. Documentação

- [ ] Atualizar README com novo fluxo
- [ ] ADR-011: JSON schema enforcement
- [ ] Guia de desenvolvimento de novas tools

## Migração de Código Legacy

Se encontrar código antigo usando:

```typescript
// ❌ NÃO USAR MAIS
await executeTool('save_memory', context, {
  type: 'movie',
  content: 'Inception',
  metadata: {...}
});
```

**Migrar para**:

```typescript
// ✅ NOVO PADRÃO
// 1. Enriquecer primeiro
const enrichResult = await executeTool('enrich_movie', context, {
	title: 'Inception',
});

// 2. Se múltiplos, pedir confirmação ao usuário
if (enrichResult.data?.length > 1) {
	// Runtime controla fluxo de confirmação
}

// 3. Salvar com tool específica
await executeTool('save_movie', context, {
	title: 'Inception',
	year: 2010,
	tmdb_id: 27205,
});
```

## Glossário

- **Ação determinística**: Executada sem LLM (ex: delete_all, list_all)
- **Planner mode**: LLM retorna JSON com tool a chamar
- **Writer mode**: LLM retorna JSON com mensagem para usuário
- **NOOP**: No Operation (nada a fazer)
- **pendingAction**: Contexto salvo quando esperando confirmação do usuário

## Referências

- [Hugging Face Agents Pattern](https://huggingface.co/docs/transformers/main/en/agents)
- [ADR-004: State Machine](./adr/004-state-machine.md)
- [ADR-005: AI-Agnostic Architecture](./adr/005-ai-agnostic.md)
- [INSTRUCTIONS.MD](../INSTRUCTIONS.MD) (guia original da refatoração)
