# Checklist de Implementação - v0.3.0

Status atual da refatoração determinística.

## ✅ Completo

- [x] Schema canônico `AgentLLMResponse` definido em `types/index.ts`
- [x] Validação `validateAgentResponse()` implementada
- [x] 11 tools específicas criadas (5 save, 3 enrich, 1 search, 2 delete)
- [x] Tool registry `AVAILABLE_TOOLS` atualizado
- [x] `AGENT_SYSTEM_PROMPT` reescrito com JSON enforcement
- [x] `CHAT_SYSTEM_PROMPT` removido
- [x] Prompts de "oferta" removidos (`OFFER_SAVE_NOTE_PROMPT`, etc)
- [x] Tool `respond()` removida
- [x] Build passando sem erros
- [x] Documentação completa em `REFACTORING-v0.3.0.md`
- [x] ADR-011 criado
- [x] README atualizado
- [x] **Schema versioning**: `schema_version: "1.0"` adicionado
- [x] **PLANNER MODE**: Prompt reforçado com modo planner explícito
- [x] **RESPOND limits**: Máximo 200 chars, validação automática
- [x] **Validação truncate**: Messages longas truncadas automaticamente

## 🚧 Em Progresso

- [ ] **Agent Orchestrator**: Adaptar `handleWithLLM()` para parsear `AgentLLMResponse`
- [ ] **AI Service**: Implementar retry com prompt reforçado
- [ ] **Context handling**: Implementar `pendingAction` para confirmações
- [ ] **Logging estruturado**: Adicionar logs JSON para cada ciclo
- [ ] **NOOP monitoring**: Métrica de % NOOP por input

## 📋 Próximos Passos

### 1. Agent Orchestrator (`src/services/agent-orchestrator.ts`)

```typescript
async function handleWithLLM(intent: IntentResult, message: Message) {
	// 1. Chamar LLM com AGENT_SYSTEM_PROMPT
	const llmResponse = await aiService.callLLM({
		systemPrompt: AGENT_SYSTEM_PROMPT,
		message: message.content,
		history,
	});

	// 2. Parsear JSON
	const agentResponse = JSON.parse(llmResponse) as AgentLLMResponse;

	// 3. Validar schema
	validateAgentResponse(agentResponse);

	// 4. Executar ação
	switch (agentResponse.action) {
		case 'CALL_TOOL':
			const result = await executeTool(agentResponse.tool!, context, agentResponse.args || {});

			// Se múltiplos resultados, salvar pendingAction
			if (result.data?.length > 1) {
				await savePendingAction(conversationId, {
					tool: agentResponse.tool,
					candidates: result.data,
				});
			}

			return result;

		case 'RESPOND':
			return { message: agentResponse.message };

		case 'NOOP':
			return { message: null };
	}
}
```

### 2. AI Service (`src/services/ai/index.ts`)

```typescript
async function callLLM(params: AICallParams): Promise<string> {
	const response = await provider.complete(params);

	// Validar que é JSON válido
	try {
		const json = JSON.parse(response);
		validateAgentResponse(json);
		return response;
	} catch (error) {
		console.error('[AI] Resposta inválida, retry...', error);
		console.error('[AI] Resposta que falhou:', response); // Log para debugging

		// Retry com prompt REFORÇADO (não apenas repetir)
		return callLLMWithRetry(
			{
				...params,
				systemPrompt: params.systemPrompt + '\n\n⚠️ SUA RESPOSTA ANTERIOR FOI INVÁLIDA. RETORNE APENAS JSON VÁLIDO SEGUINDO O SCHEMA.',
			},
			3
		);
	}
}

async function callLLMWithRetry(params: AICallParams, maxRetries: number): Promise<string> {
	for (let i = 0; i < maxRetries; i++) {
		try {
			const response = await provider.complete(params);
			const json = JSON.parse(response);
			validateAgentResponse(json);
			return response;
		} catch (error) {
			console.error(`[AI] Retry ${i + 1}/${maxRetries} falhou`, error);
			if (i === maxRetries - 1) throw error;
		}
	}
	throw new Error('Todas tentativas falharam');
}
```

### 3. Logging Estruturado (CRÍTICO)

```typescript
// Em agent-orchestrator.ts, adicionar logs JSON estruturados

interface AgentCycleLog {
	timestamp: string;
	intent: string;
	action: string;
	llm_action?: AgentAction;
	tool?: ToolName;
	args?: Record<string, any>;
	result_count?: number;
	error?: string;
	noop_usage?: boolean; // Flag para métricas de NOOP
}

async function handleWithLLM(intent: IntentResult, message: Message) {
	const cycleLog: AgentCycleLog = {
		timestamp: new Date().toISOString(),
		intent: intent.intent,
		action: intent.action,
	};

	// 1. Chamar LLM
	const llmResponse = await aiService.callLLM({
		systemPrompt: AGENT_SYSTEM_PROMPT,
		message: message.content,
		history,
	});

	// 2. Parsear JSON
	const agentResponse = JSON.parse(llmResponse) as AgentLLMResponse;
	cycleLog.llm_action = agentResponse.action;

	// 3. Validar schema
	validateAgentResponse(agentResponse);

	// 4. Executar ação
	switch (agentResponse.action) {
		case 'CALL_TOOL':
			cycleLog.tool = agentResponse.tool!;
			cycleLog.args = agentResponse.args || {};

			const result = await executeTool(agentResponse.tool!, context, agentResponse.args || {});
			cycleLog.result_count = result.data?.length || 0;

			console.log('[Agent Cycle]', JSON.stringify(cycleLog));
			return result;

		case 'RESPOND':
			console.log('[Agent Cycle]', JSON.stringify(cycleLog));
			return { message: agentResponse.message };

		case 'NOOP':
			cycleLog.noop_usage = true;
			console.warn('[Agent Cycle] ⚠️ NOOP usado', JSON.stringify(cycleLog));

			// Incrementar métrica de NOOP
			await incrementNoopMetric();

			return { message: null };
	}
}

// Monitorar % de NOOP
let noopCount = 0;
let totalCycles = 0;

async function incrementNoopMetric() {
	noopCount++;
	totalCycles++;

	const noopPercentage = (noopCount / totalCycles) * 100;

	if (noopPercentage > 8) {
		console.error(`🚨 [NOOP Alert] ${noopPercentage.toFixed(2)}% de NOOP - Prompt falhando!`);
	}
}
```

### 4. Context Schema (`src/db/schema/conversations.ts`)

```typescript
export const conversations = pgTable('conversations', {
	// ... existing fields
	pendingAction: jsonb('pending_action').$type<PendingAction | null>(),
});

type PendingAction = {
	tool: ToolName;
	args: Record<string, any>;
	candidates?: any[]; // Para confirmação de múltiplos
	expiresAt: string; // Limpar ações antigas
};
```

### 5. Confirmation Handler

```typescript
/**
 * DÉBITO TÉCNICO CONHECIDO (OK para MVP)
 *
 * extractSelection() é heurístico e pode falhar com linguagem natural.
 * Não jogar isso pra LLM é correto, mas marcar como débito.
 *
 * Futuro: considerar regex mais robusto ou NLU dedicado.
 */
async function handleConfirmation(message: Message, pendingAction: PendingAction): Promise<ToolOutput> {
	// Detectar seleção do usuário (1, 2, "primeiro", etc)
	const selection = extractSelection(message.content);

	if (selection !== null && pendingAction.candidates) {
		const chosen = pendingAction.candidates[selection];

		// Executar tool com candidato escolhido
		return executeTool(pendingAction.tool, context, { ...pendingAction.args, ...chosen });
	}

	// Se não entendeu seleção, pedir novamente
	return {
		success: false,
		message: 'Não entendi. Digite o número da opção (1, 2, etc)',
	};
}

/**
 * Extrai seleção numérica de mensagem do usuário
 *
 * Suporta:
 * - Números diretos: "1", "2"
 * - Ordinais: "primeiro", "segunda"
 * - Com texto: "o primeiro", "quero a 2"
 */
function extractSelection(content: string): number | null {
	const lower = content.toLowerCase().trim();

	// Números diretos
	if (/^\d+$/.test(lower)) {
		return parseInt(lower) - 1; // 0-indexed
	}

	// Ordinais
	const ordinals: Record<string, number> = {
		primeiro: 0,
		primeira: 0,
		segundo: 1,
		segunda: 1,
		terceiro: 2,
		terceira: 2,
		quarto: 3,
		quarta: 3,
		quinto: 4,
		quinta: 4,
	};

	for (const [word, index] of Object.entries(ordinals)) {
		if (lower.includes(word)) return index;
	}

	// Números no meio do texto
	const match = lower.match(/\d+/);
	if (match) {
		return parseInt(match[0]) - 1;
	}

	return null;
}
```

## 🧪 Testes Necessários

### Unit Tests

- [ ] `validateAgentResponse()` - todos os casos (CALL_TOOL, RESPOND, NOOP, inválidos)
- [ ] Cada tool individualmente (`save_movie`, `enrich_movie`, etc)
- [ ] `extractSelection()` - detectar "1", "primeiro", "o primeiro", etc

### Integration Tests

- [ ] LLM → JSON parsing → validation → execution
- [ ] Retry logic se JSON inválido
- [ ] pendingAction save/load

### E2E Tests

```typescript
// Teste 1: Save com enriquecimento
"salva inception"
→ LLM retorna: {"action": "CALL_TOOL", "tool": "enrich_movie", "args": {"title": "inception"}}
→ enrich_movie busca TMDB
→ Retorna múltiplos resultados
→ Bot pergunta qual
→ Usuário: "1"
→ save_movie com candidato escolhido
→ Bot confirma: "✅ Inception (2010) salvo"

// Teste 2: Ação determinística
"deleta tudo"
→ Intent Classifier: action='delete_all'
→ executeTool('delete_all_memories') diretamente
→ Bot confirma: "✅ Tudo deletado"
→ LLM NÃO FOI CHAMADA

// Teste 3: Busca
"procura filmes de terror"
→ LLM retorna: {"action": "CALL_TOOL", "tool": "search_items", "args": {"query": "terror"}}
→ search_items executa
→ Retorna lista formatada

// Teste 4: NOOP
"asdasd" (entrada inválida)
→ LLM retorna: {"action": "NOOP", "message": null}
→ Bot não responde nada
```

## 📊 Métricas de Sucesso

- [ ] 100% chamadas LLM retornam JSON válido (ou retry recupera)
- [ ] 0 falhas em ações determinísticas (delete_all, list_all)
- [ ] Tempo médio "deleta tudo": <100ms (sem LLM)
- [ ] Custo tokens/mês: -60% vs v0.2.x
- [ ] Bugs comportamento inesperado: 0

## 🐛 Debugging

Se algo falhar:

```bash
# Ver logs do servidor
pnpm run dev

# Testar tool isoladamente
pnpm test src/services/tools/index.test.ts

# Validar JSON manualmente
pnpm run scripts/test-llm-response.ts
```

## 📚 Referências

- [REFACTORING-v0.3.0.md](./REFACTORING-v0.3.0.md) - Documentação completa
- [ADR-011](./adr/011-deterministic-runtime-control.md) - Decisão arquitetural
- [INSTRUCTIONS.MD](../INSTRUCTIONS.MD) - Spec original
