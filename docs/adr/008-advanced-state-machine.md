# ADR-008: Advanced State Machine Architecture

**Status**: accepted (implementado em v0.4.0+)

**Data**: 2026-01-07  
**Atualizado**: 2026-03-01

**Nota**: originalmente "postponed", mas a state machine completa com 11 estados foi implementada.

---

## Contexto

Atualmente o Nexo AI usa uma state machine **manual e simples** para gerenciar conversações:

```typescript
type ConversationState = 'idle' | 'awaiting_confirmation' | 'enriching' | 'saving' | 'batch_processing' | 'awaiting_batch_item' | 'error';
```

Transições são diretas via `conversationService.updateState()`, sem validação ou type-safety nas transições.

### Atualização 2026-01-10

**Decisão:** ADIAR migração para XState até v1.0+ ou quando atingir critérios abaixo.

**Estado atual (v0.2.0):**

- ✅ 7 estados (abaixo do threshold de 10)
- ✅ Batch processing funcional com estado manual
- ✅ Transições funcionam bem
- ✅ Complexidade gerenciável

**Quando migrar:**

- Sistema atingir > 10 estados
- Necessidade de nested states em produção
- Necessidade de parallel states nativos
- 2+ desenvolvedores mantendo o código

Por enquanto, a implementação manual é **boa o suficiente** 👍

### Limitações do Modelo Atual

1. **Sem validação de transições**: qualquer código pode fazer `updateState("saving")` mesmo que o estado anterior seja inválido
2. **Sem ações automáticas**: não há hooks para executar código ao entrar/sair de estados
3. **Sem estados paralelos**: não é possível enriquecer TMDB + YouTube simultaneamente
4. **Sem nested states**: confirmação pode ter substates (single/multiple/ambiguous)
5. **Sem guards**: não valida condições antes de transições (ex: "só pode salvar se enriqueceu")

### Quando Adicionar Complexidade?

A state machine atual funciona porque:

- ✅ Apenas 5 estados
- ✅ Transições lineares (A → B → C)
- ✅ Sem paralelismo
- ✅ Contexto simples

**Cenários que exigem migração:**

1. Implementação de **AI Tools** (múltiplos tool calls simultâneos)
2. **Business Bots** com fluxos de atendimento complexos
3. **Bulk operations** (processar múltiplos items)
4. **Edição de items** (navegação entre estados)
5. **Mais de 10 estados** no sistema

---

## Decisão

### Fase 1: Manual State Machine (Atual) ✅

**Status**: Implementado e funcionando

Manter arquitetura atual até atingir **2+ cenários de complexidade** listados acima.

### Fase 2: Type-Safe Transitions (Próximo)

**Status**: Proposto para v0.3.0

Adicionar camada de validação **sem dependências externas**:

```typescript
// conversation-state-machine.ts
type State = 'idle' | 'awaiting_confirmation' | 'enriching' | 'saving' | 'error';

type Event =
	| { type: 'DETECT_CONTENT'; contentType: ItemType; query: string }
	| { type: 'CONFIRM_SELECTION'; index: number }
	| { type: 'MULTIPLE_RESULTS'; candidates: any[] }
	| { type: 'ENRICH_START'; itemType: ItemType }
	| { type: 'ENRICH_SUCCESS'; metadata: any }
	| { type: 'SAVE_START' }
	| { type: 'SAVE_SUCCESS' }
	| { type: 'ERROR'; message: string }
	| { type: 'RESET' };

// Matriz de transições válidas
const transitions: Record<State, Partial<Record<Event['type'], State>>> = {
	idle: {
		DETECT_CONTENT: 'awaiting_confirmation',
	},
	awaiting_confirmation: {
		CONFIRM_SELECTION: 'enriching',
		MULTIPLE_RESULTS: 'awaiting_confirmation', // mantém estado
		ERROR: 'error',
		RESET: 'idle',
	},
	enriching: {
		ENRICH_SUCCESS: 'saving',
		ERROR: 'error',
		RESET: 'idle',
	},
	saving: {
		SAVE_SUCCESS: 'idle',
		ERROR: 'error',
	},
	error: {
		DETECT_CONTENT: 'idle',
		RESET: 'idle',
	},
};

// Validador de transições
function canTransition(from: State, event: Event): boolean {
	return transitions[from]?.[event.type] !== undefined;
}

function transition(currentState: State, event: Event): State {
	const nextState = transitions[currentState][event.type];

	if (!nextState) {
		throw new Error(`Invalid transition: ${currentState} + ${event.type}`);
	}

	console.log(`State transition: ${currentState} → ${nextState}`);
	return nextState;
}

// Usage
const newState = transition(conversation.state, {
	type: 'DETECT_CONTENT',
	contentType: 'movie',
	query: 'Matrix',
});

await conversationService.updateState(conversationId, newState, context);
```

**Vantagens:**

- ✅ Type-safe transitions
- ✅ Zero dependências
- ✅ Validação em runtime
- ✅ Logs automáticos
- ✅ Fácil de testar

### Fase 3: XState Migration (Futuro)

**Status**: Proposto para v0.5.0+

Migrar para [XState](https://xstate.js.org/) quando atingir **2+ cenários**:

#### Cenário A: Nested States (Substates)

```typescript
import { createMachine } from 'xstate';

const conversationMachine = createMachine({
	id: 'conversation',
	initial: 'idle',
	states: {
		idle: {
			on: { DETECT_CONTENT: 'processing' },
		},

		// ✨ Nested state
		processing: {
			initial: 'classifying',
			states: {
				classifying: {
					invoke: {
						src: 'classifyContent',
						onDone: { target: 'searching' },
						onError: { target: '#conversation.error' },
					},
				},
				searching: {
					invoke: {
						src: 'searchExternal',
						onDone: [
							{ target: 'singleResult', cond: 'isSingleResult' },
							{ target: 'multipleResults', cond: 'isMultipleResults' },
							{ target: 'noResults' },
						],
					},
				},
				singleResult: {
					on: { CONFIRM: '#conversation.enriching' },
				},
				multipleResults: {
					on: {
						SELECT: { target: 'singleResult', actions: 'setSelection' },
					},
				},
				noResults: {
					on: { RETRY: 'classifying' },
				},
			},
		},

		enriching: {
			on: { SUCCESS: 'saving' },
		},

		saving: {
			invoke: {
				src: 'saveItem',
				onDone: 'idle',
				onError: 'error',
			},
		},

		error: {
			on: { RETRY: 'idle' },
		},
	},
});
```

#### Cenário B: Parallel States (Operações Simultâneas)

```typescript
const enrichmentMachine = createMachine({
	id: 'enrichment',
	type: 'parallel',

	states: {
		// ✨ Estado paralelo 1
		tmdbEnrichment: {
			initial: 'idle',
			states: {
				idle: { on: { START: 'loading' } },
				loading: {
					invoke: {
						src: 'fetchTMDB',
						onDone: { target: 'success', actions: 'saveTMDBData' },
						onError: 'error',
					},
				},
				success: { type: 'final' },
				error: { on: { RETRY: 'loading' } },
			},
		},

		// ✨ Estado paralelo 2
		streamingEnrichment: {
			initial: 'idle',
			states: {
				idle: { on: { START: 'loading' } },
				loading: {
					invoke: {
						src: 'fetchStreaming',
						onDone: { target: 'success', actions: 'saveStreamingData' },
						onError: 'error',
					},
				},
				success: { type: 'final' },
				error: { on: { RETRY: 'loading' } },
			},
		},

		// ✨ Estado paralelo 3
		aiEnrichment: {
			initial: 'idle',
			states: {
				idle: { on: { START: 'generating' } },
				generating: {
					invoke: {
						src: 'generateTags',
						onDone: { target: 'success', actions: 'saveTags' },
						onError: 'error',
					},
				},
				success: { type: 'final' },
				error: {},
			},
		},
	},

	// Quando TODOS os substates atingirem "final" ou "success"
	onDone: {
		target: 'completed',
	},
});
```

#### Cenário C: Guards e Actions

```typescript
const itemSavingMachine = createMachine(
	{
		id: 'itemSaving',
		initial: 'validating',

		context: {
			item: null,
			isEnriched: false,
			userConfirmed: false,
			isDuplicate: false,
		},

		states: {
			validating: {
				invoke: {
					src: 'checkDuplicate',
					onDone: [
						{
							target: 'warning',
							cond: 'isDuplicate', // ✨ Guard
							actions: 'setDuplicateFlag',
						},
						{ target: 'ready' },
					],
				},
			},

			warning: {
				on: {
					OVERRIDE: {
						target: 'ready',
						// ✨ Guard: só permite se usuário é admin
						cond: (ctx, event) => event.userRole === 'admin',
					},
					CANCEL: 'idle',
				},
			},

			ready: {
				// ✨ Action ao entrar no estado
				entry: ['logReadyState', 'notifyUser'],

				on: {
					SAVE: {
						target: 'saving',
						// ✨ Guards compostos
						cond: (ctx) => ctx.isEnriched && ctx.userConfirmed && !ctx.isDuplicate,
					},
				},
			},

			saving: {
				// ✨ Action ao sair do estado
				exit: ['clearCache'],

				invoke: {
					src: 'saveToDatabase',
					onDone: {
						target: 'success',
						actions: ['trackAnalytics', 'sendNotification'], // ✨ Multiple actions
					},
					onError: 'error',
				},
			},

			success: {
				type: 'final',
				// ✨ Action final
				entry: 'resetConversation',
			},

			error: {
				on: {
					RETRY: 'validating',
				},
			},
		},
	},
	{
		guards: {
			isDuplicate: (ctx) => ctx.isDuplicate,
		},
		actions: {
			logReadyState: () => console.log('Item ready to save'),
			notifyUser: (ctx) => console.log('Notifying user...'),
			clearCache: () => console.log('Clearing cache...'),
			trackAnalytics: () => console.log('Tracking event...'),
			sendNotification: () => console.log('Sending notification...'),
			resetConversation: () => console.log('Resetting conversation...'),
		},
	},
);
```

#### Cenário D: History States (Navegação)

```typescript
const editingMachine = createMachine({
	id: 'editing',
	initial: 'viewing',

	states: {
		viewing: {
			on: { EDIT: 'editing' },
		},

		editing: {
			// ✨ History state: lembra último substate
			type: 'history',
			history: 'deep',

			initial: 'editingTitle',
			states: {
				editingTitle: {
					on: {
						NEXT: 'editingMetadata',
						SAVE: '#editing.saving',
					},
				},
				editingMetadata: {
					on: {
						BACK: 'editingTitle', // volta
						NEXT: 'editingTags',
						SAVE: '#editing.saving',
					},
				},
				editingTags: {
					on: {
						BACK: 'editingMetadata',
						SAVE: '#editing.saving',
					},
				},
				saving: {
					invoke: {
						src: 'saveChanges',
						onDone: '#editing.viewing',
						onError: '#editing.error',
					},
				},
			},
		},

		error: {
			on: {
				// ✨ Volta para o último estado de edição
				BACK: 'editing.hist',
			},
		},
	},
});
```

---

## Estrutura de Arquivos Proposta

### Fase 2: Type-Safe (v0.3.0)

```
src/
├── services/
│   └── conversation/
│       ├── conversation-service.ts (atual)
│       ├── state-machine.ts (novo) ✨
│       └── types.ts (novo) ✨
```

**Implementação:**

```typescript
// state-machine.ts
export type ConversationState = "idle" | "awaiting_confirmation" | ...;
export type ConversationEvent = { type: "DETECT_CONTENT", ... } | ...;
export const transitions = { ... };
export function transition(state, event): State { ... }
export function canTransition(state, event): boolean { ... }

// conversation-service.ts (modificado)
import { transition } from "./state-machine";

async updateState(conversationId, event, context) {
  const current = await this.getConversation(conversationId);
  const newState = transition(current.state, event); // ✨ validação

  return db.update(conversations)
    .set({ state: newState, context, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .returning();
}
```

### Fase 3: XState (v0.5.0+)

```
src/
├── machines/
│   ├── conversation-machine.ts ✨
│   ├── enrichment-machine.ts ✨
│   ├── editing-machine.ts ✨
│   └── types.ts
├── services/
│   └── conversation/
│       ├── conversation-service.ts (modificado)
│       └── machine-adapter.ts (novo) ✨
```

**Implementação:**

```typescript
// conversation-machine.ts
import { createMachine } from "xstate";
export const conversationMachine = createMachine({ ... });

// machine-adapter.ts
import { interpret } from "xstate";
import { conversationMachine } from "@/machines/conversation-machine";

export class MachineAdapter {
  private service = interpret(conversationMachine);

  start() {
    this.service.start();
  }

  send(event: Event) {
    this.service.send(event);
  }

  getState() {
    return this.service.state.value;
  }

  subscribe(callback) {
    return this.service.subscribe(callback);
  }
}

// conversation-service.ts (modificado para usar XState)
import { MachineAdapter } from "./machine-adapter";

async processMessage(message: string) {
  const machine = new MachineAdapter();
  machine.start();

  machine.subscribe((state) => {
    // Persiste no DB
    this.updateState(conversationId, state.value, state.context);
  });

  machine.send({ type: "DETECT_CONTENT", message });
}
```

---

## Métricas de Decisão

### Quando NÃO usar XState

- ✅ < 7 estados
- ✅ Transições lineares (A → B → C)
- ✅ Sem paralelismo
- ✅ Sem nested states
- ✅ Time pequeno (<3 devs)

### Quando USAR XState

- ❌ > 10 estados
- ❌ Transições com guards/conditions
- ❌ Parallel states necessário
- ❌ Nested states (sub-fluxos)
- ❌ Precisa de state visualization
- ❌ Histórico de navegação entre estados
- ❌ Time > 3 devs (documentação automática)

---

## Consequências

### Fase 2: Type-Safe Transitions

**Positivas:**

- ✅ Type-safety imediato
- ✅ Zero dependências
- ✅ Validação em runtime
- ✅ Fácil de testar
- ✅ Backward compatible

**Negativas:**

- ⚠️ Manutenção manual da matriz de transições
- ⚠️ Sem visualização gráfica
- ⚠️ Sem parallel/nested states nativos

### Fase 3: XState Migration

**Positivas:**

- ✅ Nested states nativos
- ✅ Parallel states nativos
- ✅ Guards/actions declarativos
- ✅ History states
- ✅ Visualização com [@xstate/inspect](https://stately.ai/docs/inspector)
- ✅ DevTools integration
- ✅ Documentação automática via Stately.ai

**Negativas:**

- ⚠️ +40kb bundle size
- ⚠️ Curva de aprendizado
- ⚠️ Mais abstração
- ⚠️ Pode ser overkill se não usar features avançadas

---

## Alternativas Consideradas

### 1. Robot3 (lightweight FSM)

- **Prós**: Apenas 1kb, simples
- **Contras**: Sem nested states, sem visualização
- **Decisão**: Muito limitado para crescimento futuro

### 2. State-machine-cat

- **Prós**: Apenas validação, leve
- **Contras**: Sem runtime execution
- **Decisão**: Só validação, não substitui XState

### 3. Zustand + Immer

- **Prós**: Já familiar em React apps
- **Contras**: Não é state machine, é state management
- **Decisão**: Conceito diferente, não resolve o problema

### 4. Custom Implementation (atual)

- **Prós**: Zero deps, total controle
- **Contras**: Manutenção manual, sem features avançadas
- **Decisão**: ✅ **Escolhido para MVP, migrar depois**

---

## Referências

- [XState Documentation](https://xstate.js.org/docs/)
- [Stately.ai - Visual State Machine Editor](https://stately.ai/)
- [State Machines in JavaScript](https://www.freecodecamp.org/news/state-machines-in-javascript/)
- [ADR-004: State Machine atual](./004-state-machine.md)

---

## Status de Implementação

| Fase              | Status          | Versão Alvo | Prioridade |
| ----------------- | --------------- | ----------- | ---------- |
| Fase 1: Manual    | ✅ Implementado | v0.1.0      | -          |
| Fase 2: Type-Safe | 📋 Proposto     | v0.3.0      | Média      |
| Fase 3: XState    | 🔮 Futuro       | v0.5.0+     | Baixa      |

**Próximos Passos:**

1. Implementar Fase 2 quando adicionar AI Tools (v0.3.0)
2. Reavaliar necessidade de XState a cada 3 meses
3. Migrar para XState quando atingir 10+ estados ou 2+ cenários complexos
