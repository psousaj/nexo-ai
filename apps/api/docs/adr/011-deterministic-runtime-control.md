# ADR-011: Controle Runtime Determinístico

**Status**: accepted

**Data**: 2025-01-08

## Contexto

O sistema usava LLM para decidir **tudo**:

- Quando salvar vs apenas responder
- Quando pedir confirmação vs executar direto
- Que tipo de resposta dar (formal vs casual)
- Quando usar ferramentas vs responder texto livre

**Problemas identificados**:

1. **Imprevisibilidade**: "deleta tudo" às vezes executava, às vezes apenas descrevia
2. **Ofertas desnecessárias**: LLM perguntava "quer que eu salve?" quando devia salvar
3. **Conversação livre**: Bot fazia small talk, usava emojis, comportamento não determinístico
4. **Debugging difícil**: "Por que a LLM decidiu X ao invés de Y?"
5. **Custo**: LLM chamada mesmo para ações triviais (listar tudo, deletar tudo)
6. **Tools genéricas**: `save_memory(type, content)` causava ambiguidade

## Decisão

Implementar **controle runtime 100% determinístico** seguindo Hugging Face Agents pattern:

### 1. Schema JSON Canônico

```typescript
interface AgentLLMResponse {
	action: 'CALL_TOOL' | 'RESPOND' | 'NOOP';
	tool?: ToolName;
	args?: Record<string, any>;
	message?: string | null;
}
```

**Regras**:

- `action=CALL_TOOL` → obrigatório `tool`
- `action=NOOP` → obrigatório `message=null`
- Validado por `validateAgentResponse()`

### 2. Tools com Contratos Fortes

**Antes**:

```typescript
save_memory(type: 'movie'|'note', content: string)  // ambíguo
```

**Depois**:

```typescript
save_note(content: string)
save_movie(title: string, year?: number, tmdb_id?: number)
save_tv_show(title: string, year?: number, tmdb_id?: number)
save_video(url: string, title?: string)
save_link(url: string, description?: string)
```

**Total**: 11 tools específicas (5 save, 3 enrich, 1 search, 2 delete)

### 3. Eliminação de Conversação Livre

**Removido**:

- `CHAT_SYSTEM_PROMPT`
- `OFFER_SAVE_NOTE_PROMPT`
- Tool `respond()` (wrapper genérico)

**Novo**: `AGENT_SYSTEM_PROMPT`

- Apenas instrui JSON output
- Lista explícita de todas as tools
- Exemplos JSON para cada action type
- Regras: sem conversação, sem ofertas, sem emojis

### 4. Ações Determinísticas Sem LLM

```typescript
// Intent Classifier detecta action
switch (intent.action) {
	case 'delete_all':
		return handleDeleteAll(); // executa direto, sem LLM
	case 'list_all':
		return handleListAll(); // executa direto, sem LLM
	case 'cancel':
		return handleCancel(); // limpa contexto, sem LLM
	default:
		return handleWithLLM(); // apenas aqui LLM é chamada
}
```

## Consequências

### Positivas

1. **Previsibilidade total**: Mesma entrada → mesma saída sempre
2. **Debugging trivial**: Logs mostram: intent.action → tool → result
3. **Testabilidade**: Cada tool isolada, JSON validado
4. **Performance**: Ações determinísticas pulam LLM (economia de tokens)
5. **Manutenibilidade**: Lógica de negócio no código, não no prompt
6. **Type-safety**: TypeScript valida contratos de tool
7. **Custo reduzido**: Menos chamadas LLM, prompts menores

### Negativas

1. **Rigidez**: Menos flexibilidade conversacional
2. **Mais código**: Lógica explícita para cada caso
3. **Manutenção de tools**: Adicionar tipo novo = nova tool
4. **JSON enforcement**: Precisa retry se LLM retornar inválido

## Implementação

### Antes (v0.2.x)

```typescript
// LLM decide tudo via CHAT_SYSTEM_PROMPT
const llmResponse = await callLLM({
	systemPrompt: CHAT_SYSTEM_PROMPT,
	message: userMessage,
});

// Resposta varia: às vezes salva, às vezes oferece, às vezes conversa
if (llmResponse.includes('salvei')) {
	// ???
}
```

### Depois (v0.3.0)

```typescript
// 1. Intent Classifier decide action (determinístico)
const intent = await intentClassifier.classify(message);

// 2. Runtime roteia action
if (intent.action === 'delete_all') {
	// Executa direto, sem LLM
	const result = await executeTool('delete_all_memories', context, {});
	return { message: GENERIC_CONFIRMATION };
}

// 3. LLM apenas planeja (JSON)
const llmResponse = await callLLM({
	systemPrompt: AGENT_SYSTEM_PROMPT, // enforça JSON
	message: userMessage,
	history,
});

// 4. Valida schema
validateAgentResponse(llmResponse);

// 5. Executa tool planejada
if (llmResponse.action === 'CALL_TOOL') {
	const result = await executeTool(llmResponse.tool, context, llmResponse.args);

	// 6. Runtime decide o que fazer com resultado
	if (result.data?.length > 1) {
		// Múltiplos resultados → pedir confirmação
		return askUserToChoose(result.data);
	}
}
```

## Fluxo Completo (Exemplo)

```
User: "salva inception"
  ↓
Intent Classifier: {action: 'save', entities: {content: 'inception'}}
  ↓
Runtime: action='save' → chama LLM (planner mode)
  ↓
LLM retorna JSON: {"action": "CALL_TOOL", "tool": "enrich_movie", "args": {"title": "inception"}}
  ↓
Runtime executa: enrich_movie(title="inception")
  ↓
Tool retorna: [{id: 27205, title: "Inception", year: 2010}, {id: 12345, title: "Inception", year: 2014}]
  ↓
Runtime detecta: múltiplos resultados
  ↓
LLM retorna JSON: {"action": "RESPOND", "message": "Encontrei 2 filmes:\n1. Inception (2010)\n2. Inception (2014)\nQual?"}
  ↓
Runtime envia mensagem + salva pendingAction no contexto
  ↓
User: "1"
  ↓
Runtime detecta: pendingAction existe
  ↓
Runtime extrai: selection=0
  ↓
Runtime executa: save_movie(title="Inception", year=2010, tmdb_id=27205)
  ↓
Runtime responde: "✅ Inception (2010) salvo"
```

## Migração

### Tools Antigas → Novas

| Antiga                       | Nova                                          |
| ---------------------------- | --------------------------------------------- |
| `save_memory(type='movie')`  | `save_movie(title, year?, tmdb_id?)`          |
| `save_memory(type='note')`   | `save_note(content)`                          |
| `search_memory(query)`       | `search_items(query?, limit?)`                |
| `enrich_content(type, data)` | `enrich_movie(title, year?)`                  |
| `list_memories()`            | `search_items()` (sem query)                  |
| `respond(message)`           | ❌ Removido - LLM retorna message diretamente |

### Prompts Antigos → Novos

| Antigo                   | Novo                                     |
| ------------------------ | ---------------------------------------- |
| `CHAT_SYSTEM_PROMPT`     | ❌ Removido                              |
| `OFFER_SAVE_NOTE_PROMPT` | ❌ Removido                              |
| `INTENT_ROUTER_PROMPT`   | ❌ Removido (Intent Classifier é código) |
| `STRICT_JSON_PROMPT`     | ✅ Incorporado em `AGENT_SYSTEM_PROMPT`  |

## Alternativas Consideradas

### 1. LangChain ReAct Agent

**Prós**: Framework estabelecido, comunidade grande  
**Contras**:

- Abstrações pesadas
- Difícil customizar fluxo
- Conversação ainda controlada por LLM

### 2. State Machine Complexa (FSM)

**Prós**: Controle total, visual claro  
**Contras**:

- Overkill para MVP
- Difícil manter sincronizado com tools
- Ver ADR-008 (postponed)

### 3. LLM como Orquestrador (status quo)

**Prós**: Flexível, adaptativo  
**Contras**:

- Imprevisível (problema atual)
- Caro (muitas chamadas)
- Difícil debugar

## Validação

**Como testar se funciona**:

1. **Determinismo**: Rodar 10x "deleta tudo" → sempre mesmo comportamento
2. **Schema**: LLM nunca retorna JSON inválido (ou retry funciona)
3. **Tools**: `save_movie()` sempre cria item tipo 'movie', nunca 'note'
4. **Zero conversação**: Bot nunca responde "oi tudo bem?" para "oi"
5. **Performance**: "lista tudo" não chama LLM (apenas banco)

## Métricas de Sucesso

- ✅ 0 falhas de JSON parsing (ou retry recupera 100%)
- ✅ 100% ações determinísticas executam sem LLM
- ✅ Tempo médio "deleta tudo": <100ms (antes: ~2s com LLM)
- ✅ Custo tokens/mês: -60% (estimado)
- ✅ Bugs de comportamento inesperado: 0

## Referências

- [Hugging Face Agents Documentation](https://huggingface.co/docs/transformers/main/en/agents)
- [ADR-004: State Machine](004-state-machine.md)
- [ADR-005: AI-Agnostic Architecture](005-ai-agnostic.md)
- [REFACTORING-v0.3.0.md](../REFACTORING-v0.3.0.md)
- [INSTRUCTIONS.MD](../../INSTRUCTIONS.MD) (spec original)
