# ADR-004: State Machine para Conversação

**Status**: accepted

**Data**: 2026-01-05

## Contexto

Conversas com usuário via WhatsApp requerem múltiplas interações:

1. Usuário envia "clube da luta"
2. Bot busca no TMDB (múltiplos resultados)
3. Bot pergunta "qual deles?"
4. Usuário responde "o primeiro"
5. Bot salva e confirma

Precisamos manter contexto entre mensagens.

## Decisão

Implementar **state machine explícita** persistida no banco.

Estados:

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

## Consequências

### Positivas

- **Previsível**: fluxo claro, fácil de debugar
- **Testável**: cada transição isolada
- **Resiliente**: estado persiste entre requests
- **Multi-turn**: suporta conversas longas

### Negativas

- **Complexidade**: mais código que "stateless"
- **DB writes**: toda transição = UPDATE
- **Timeout handling**: precisa limpar estados antigos

## Implementação

```typescript
// conversations table
export const conversations = pgTable('conversations', {
  state: text('state').default('idle'),
  context: jsonb('context').$type<ConversationContext>(),
});

// Service
async updateState(conversationId: string, newState: State, context?: Context) {
  await db.update(conversations)
    .set({ state: newState, context })
    .where(eq(conversations.id, conversationId));
}
```

## Alternativas Consideradas

1. **Stateless + LLM memory**: Depende do modelo, caro
2. **Session storage**: Perde em cold start/scaling
3. **Event sourcing completo**: Overkill para MVP
