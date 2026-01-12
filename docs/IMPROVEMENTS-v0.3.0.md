# Melhorias v0.3.0 - Refatoração de Controle Determinístico

**Data**: 2025-01-12  
**Status**: ✅ Implementado

Baseado em code review das sugestões de melhoria da arquitetura determinística.

## 🎯 Melhorias Implementadas

### 1. ✅ Schema Versioning

**Problema anterior**: Sem versionamento, mudanças futuras quebram runtime.

**Solução**:

```typescript
export interface AgentLLMResponse {
	schema_version: string; // Versionamento para compatibilidade futura
	action: AgentAction;
	tool?: ToolName | null;
	args?: Record<string, any> | null;
	message?: string | null;
}

const CURRENT_SCHEMA_VERSION = '1.0';
```

**Benefício**: Quando mudar schema para v2.0, runtime pode detectar e adaptar comportamento.

**Arquivo**: [src/types/index.ts](../src/types/index.ts)

---

### 2. ✅ PLANNER MODE Explícito

**Problema anterior**: LLM podia "escapar" para modo conversação.

**Solução**: Reforçar no prompt que está em PLANNER MODE:

```typescript
export const AGENT_SYSTEM_PROMPT = `# OPERATING MODE: PLANNER

You are operating in PLANNER MODE.
You do NOT chat.
You do NOT explain.
You ONLY select actions.
...
`;
```

**Benefício**: Reduz alucinação conversacional mais do que apenas exemplos.

**Arquivo**: [src/config/prompts.ts](../src/config/prompts.ts)

---

### 3. ✅ Limites em RESPOND

**Problema anterior**: RESPOND permitia "explicar demais", vazar contexto.

**Solução**:

#### No Prompt:

```typescript
## RESPOND
- "message" obrigatória
- MÁXIMO 1 frase curta (<200 chars)
- NUNCA explicar ações já executadas
- NUNCA repetir dados retornados por tools
- Usar APENAS quando não há tool apropriada
```

#### Na Validação:

```typescript
// Validar tamanho de RESPOND (máx 200 chars)
if (response.action === 'RESPOND' && response.message) {
	if (response.message.length > 200) {
		console.warn(`[Schema] RESPOND muito longo: ${response.message.length} chars`);
		response.message = response.message.substring(0, 197) + '...';
	}
}
```

**Benefício**:

- Truncate automático previne fugas de controle
- LLM não pode "explicar demais"
- Runtime mantém controle total

**Arquivo**: [src/types/index.ts](../src/types/index.ts) (validação)

---

### 4. ✅ Validação de Schema Version

**Implementação**:

```typescript
// Validar schema_version
if (response.schema_version !== CURRENT_SCHEMA_VERSION) {
	console.warn(`[Schema] Versão incompatível: ${response.schema_version}, esperado: ${CURRENT_SCHEMA_VERSION}`);
}
```

**Benefício**: Detecta respostas com schema antigo/futuro.

---

## 📋 Próximas Implementações (Checklist)

### 1. ⏳ NOOP Monitoring

**O que fazer**:

```typescript
// Logar toda ocorrência de NOOP
let noopCount = 0;
let totalCycles = 0;

if (response.action === 'NOOP') {
	noopCount++;
	totalCycles++;

	const noopPercentage = (noopCount / totalCycles) * 100;

	if (noopPercentage > 8) {
		console.error(`🚨 [NOOP Alert] ${noopPercentage.toFixed(2)}% de NOOP - Prompt falhando!`);
	}
}
```

**Por que**: LLM adora usar NOOP quando insegura. Se passar de 5-8%, prompt está falhando.

**Onde**: [src/services/agent-orchestrator.ts](../src/services/agent-orchestrator.ts)

---

### 2. ⏳ Retry com Prompt Reforçado

**Problema**: Retry cego repete mesmo erro gastando tokens.

**Solução**:

```typescript
async function callLLM(params: AICallParams): Promise<string> {
	const response = await provider.complete(params);

	try {
		const json = JSON.parse(response);
		validateAgentResponse(json);
		return response;
	} catch (error) {
		console.error('[AI] Resposta inválida:', response); // LOG GOLD para debug

		// Retry com prompt REFORÇADO
		return callLLMWithRetry(
			{
				...params,
				systemPrompt: params.systemPrompt + '\n\n⚠️ SUA RESPOSTA ANTERIOR FOI INVÁLIDA. RETORNE APENAS JSON VÁLIDO.',
			},
			3
		);
	}
}
```

**Benefício**:

- Não repete erro burro
- Loga resposta inválida (gold para debug)
- Aumenta taxa de sucesso no retry

**Onde**: [src/services/ai/index.ts](../src/services/ai/index.ts)

---

### 3. ⏳ Logging Estruturado Obrigatório

**O que fazer**:

```typescript
interface AgentCycleLog {
	timestamp: string;
	intent: string;
	action: string;
	llm_action?: AgentAction;
	tool?: ToolName;
	args?: Record<string, any>;
	result_count?: number;
	error?: string;
	noop_usage?: boolean;
}

// Em cada ciclo:
const cycleLog: AgentCycleLog = {
	timestamp: new Date().toISOString(),
	intent: intent.intent,
	action: intent.action,
};

console.log('[Agent Cycle]', JSON.stringify(cycleLog));
```

**Benefício**: Bugs viram dados, não achismo.

**Onde**: [src/services/agent-orchestrator.ts](../src/services/agent-orchestrator.ts)

---

### 4. ✅ Débito Técnico Marcado: extractSelection()

**O que é**: Parsing heurístico de seleção ("1", "primeiro", etc).

**Status**: OK para MVP, não jogar pra LLM foi correto.

**Futuro**: Considerar regex mais robusto ou NLU dedicado.

**Onde documentado**: [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md#5-confirmation-handler)

---

## 📊 Comparação Antes vs Depois

| Aspecto              | Antes (v0.2.x)     | Depois (v0.3.0)                  |
| -------------------- | ------------------ | -------------------------------- |
| **RESPOND length**   | Ilimitado          | ✅ Máx 200 chars (auto-truncate) |
| **Schema version**   | ❌ Não tinha       | ✅ v1.0 (versionado)             |
| **PLANNER MODE**     | Implícito          | ✅ Explícito no prompt           |
| **NOOP monitoring**  | ❌ Não tinha       | ⏳ Próxima implementação         |
| **Retry logic**      | Cego (repete erro) | ⏳ Reforçado (próximo)           |
| **Logging**          | Console simples    | ⏳ Estruturado JSON (próximo)    |
| **extractSelection** | ❌ Não documentado | ✅ Débito técnico marcado        |

## 🔍 Riscos Mitigados

### ⚠️ 1. RESPOND permitindo fuga de controle

**Antes**: LLM podia escrever parágrafos explicando ações.

**Mitigação**:

- Prompt: "MÁXIMO 1 frase curta"
- Validação: Truncate automático em 200 chars
- Logs: Warning se passar limite

### ⚠️ 2. NOOP virando escape hatch

**Antes**: Sem monitoramento, LLM abusava de NOOP.

**Mitigação**:

- Logar toda ocorrência
- Métrica: % NOOP por input
- Alert se passar de 8%

### ⚠️ 3. Retry infinito disfarçado

**Antes**: Repetia mesmo prompt com mesmo erro.

**Mitigação**:

- Retry com prompt reforçado
- Log da resposta inválida (debug gold)
- Máx 3 tentativas

### ⚠️ 4. Confirmação com parsing textual

**Antes**: Não era tratado como débito técnico.

**Mitigação**:

- Documentado como débito conhecido
- Implementação heurística robusta
- Não jogar pra LLM (correto para MVP)

## 📚 Arquivos Modificados

| Arquivo                                                                     | Mudança                                       |
| --------------------------------------------------------------------------- | --------------------------------------------- |
| [src/types/index.ts](../src/types/index.ts)                                 | ✅ Schema versioning, RESPOND truncate        |
| [src/config/prompts.ts](../src/config/prompts.ts)                           | ✅ PLANNER MODE explícito, limites em RESPOND |
| [docs/IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md)           | ✅ Guia de implementação completo             |
| [src/services/agent-orchestrator.ts](../src/services/agent-orchestrator.ts) | ⏳ NOOP monitoring (próximo)                  |
| [src/services/ai/index.ts](../src/services/ai/index.ts)                     | ⏳ Retry reforçado (próximo)                  |

## 🎓 Aprendizados

### O que funcionou bem:

1. **Truncate automático**: Previne fugas sem quebrar nada
2. **Schema versioning**: Pequeno detalhe, grande futuro benefit
3. **PLANNER MODE explícito**: Reduz alucinação mais que exemplos
4. **Débito técnico marcado**: extractSelection() documentado

### Próximos passos críticos:

1. **NOOP monitoring** - Métrica essencial de saúde do prompt
2. **Retry inteligente** - Não repetir burrice
3. **Logging estruturado** - Transformar bugs em dados

## 🚀 Como Testar

```bash
# 1. Build
bun run build

# 2. Dev
bun run dev

# 3. Testar RESPOND truncate
# Enviar mensagem que gera RESPOND longo → deve truncar

# 4. Testar schema_version
# LLM deve retornar {"schema_version": "1.0", ...}

# 5. Verificar logs
# Warnings de RESPOND longo devem aparecer
```

## 📖 Referências

- [REFACTORING-v0.3.0.md](./REFACTORING-v0.3.0.md) - Refatoração completa
- [ADR-011](./adr/011-deterministic-runtime-control.md) - Decisão arquitetural
- [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md) - Checklist completo
