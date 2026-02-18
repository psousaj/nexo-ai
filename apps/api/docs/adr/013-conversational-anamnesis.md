# ADR-013: Anamnese Conversacional (Clarificação N1/N2)

**Status**: accepted

**Data**: 2026-01-16

## Contexto

O sistema v0.3.0 era muito pragmático: detectava intenção e executava ação diretamente, sem clarificação. Isso causava problemas:

1. **Notas longas classificadas incorretamente**: Mensagens extensas sobre implementação técnica eram interpretadas como "save_content" (filme, série) ao invés de notas.
2. **Sem oportunidade de confirmação**: O usuário não tinha chance de corrigir antes da ação ser executada.
3. **Falta de contexto**: Sistema assumia intenção sem verificar, causando salvamentos errados.

**Exemplo real do problema:**
```
User: "Salvar info tmdb como vector na base de dados ao salvar e ao buscar enrichment para seleção do usuário..."
System: [detecta "madagascar" na mensagem]
Intent: save_content (query: "madagascar", url: "tmdb.org/madagascar")
Action: LLM → save_note
Result: ❌ Erro ao salvar (silencioso)
```

O LLM detectou corretamente que era uma nota, mas o processo não tinha clarificação intermediária.

## Decisão

Implementar **fluxo de anamnese conversacional** (N1/N2) similar a triagem médica:

### N1: Coleta de Contexto (Anamnese Inicial)
Sistema detecta mensagens ambíguas/longas e **solicita clarificação** antes de agir:
- Mensagens >150 chars sem verbos de ação claros (`salva`, `busca`, `deleta`)
- Sistema pergunta: "É uma nota, filme, série ou link?"
- Usuário escolhe entre 5 opções numeradas

### N2: Confirmação
Após clarificação, sistema **confirma** antes de executar:
- "Entendido! Deseja salvar como {tipo}?"
- Usuário responde "sim" ou "não"
- Só então executa a ação

## Consequências

### Positivas
1. **Reduz erros de classificação**: Usuário clarifica intenção antes da execução.
2. **Melhora UX em casos ambíguos**: Menos frustrações com ações erradas.
3. **Mantém determinismo**: Runtime ainda controla fluxo, LLM não decide sozinho.
4. **Permite correção**: Usuário pode cancelar (opção 5) ou negar confirmação.
5. **Logs detalhados**: Todas as escolhas ficam registradas para debug.

### Negativas
1. **Mais interações**: Requer 2-3 mensagens ao invés de 1 (clarificação + confirmação).
2. **Latência percebida**: Usuário precisa esperar e responder múltiplas vezes.
3. **Complexidade de estado**: Novo estado `awaiting_context` + campo `pendingClarification`.
4. **Multi-provider**: `handleAmbiguousMessage` usa `whatsappService` diretamente (precisa abstrair).

## Implementação

### 1. Novo Estado
```typescript
export type ConversationState =
  | 'idle'
  | 'processing'
  | 'awaiting_context'     // NOVO: aguardando clarificação
  | 'awaiting_confirmation'
  | 'waiting_close'
  | 'closed';
```

### 2. Contexto Estendido
```typescript
export interface ConversationContext {
  pendingClarification?: {
    originalMessage: string;
    detectedType: string | null;
    clarificationOptions: string[];
  };
}
```

### 3. Detecção de Ambiguidade
```typescript
// conversation-service.ts
async handleAmbiguousMessage(conversationId: string, message: string): Promise<boolean> {
  const hasActionVerb = /^(salva|adiciona|busca|lista|deleta)/i.test(message.trim());
  
  if (message.length > 150 && !hasActionVerb) {
    // Solicita clarificação
    await this.updateState(conversationId, 'awaiting_context', {
      pendingClarification: { originalMessage: message, detectedType: null, clarificationOptions }
    });
    
    // Envia mensagem com opções
    await messagingService.send(conversationId, `${clarificationMsg}\n\n1. Nota\n2. Filme\n3. Série\n4. Link\n5. Cancelar`);
    
    return true; // Ambiguidade detectada
  }
  
  return false;
}
```

### 4. Handler de Clarificação
```typescript
// agent-orchestrator.ts
private async handleClarificationResponse(context: AgentContext, conversation: any): Promise<AgentResponse> {
  const choice = parseInt(context.message.trim());
  
  switch (choice) {
    case 1: detectedType = 'note'; break;
    case 2: detectedType = 'movie'; break;
    case 3: detectedType = 'series'; break;
    case 4: detectedType = 'link'; break;
    case 5: // Cancela
      await conversationService.updateState(conversation.id, 'idle', { pendingClarification: undefined });
      return { message: '❌ Operação cancelada.', state: 'idle' };
  }
  
  // Transita para awaiting_confirmation
  await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
    forcedType: detectedType,
    originalMessage: pendingClarification.originalMessage
  });
  
  return { message: `Confirma: salvar como ${detectedType}?`, state: 'awaiting_confirmation' };
}
```

### 5. Centralização de Mensagens
**Novo arquivo**: `src/services/conversation/messageTemplates.ts`

```typescript
export const clarificationMessages = [
  "📝 Recebi sua mensagem. O que você gostaria de fazer com isso?",
  "🤔 Hmm, interessante! Isso é uma nota, filme, série ou outra coisa?",
  // ... variações
];

export const confirmationMessages = [
  "✅ Entendido! Deseja salvar como {type}?",
  // ... variações
];

export function getRandomMessage(templates: string[], replacements?: Record<string, string>): string {
  const template = templates[Math.floor(Math.random() * templates.length)];
  return Object.entries(replacements || {}).reduce(
    (msg, [key, value]) => msg.replace(`{${key}}`, value),
    template
  );
}
```

### 6. Logs Estruturados
**Novo arquivo**: `src/services/conversation/logMessages.ts`

Centraliza todos os logs do sistema (AI providers, tools, enrichment, state transitions) para facilitar debug e evitar hardcoding.

## Fluxo Completo (Exemplo)

```
User: "Salvar info tmdb como vector na base de dados ao salvar e ao buscar enrichment..."
  ↓
System: detecta mensagem longa (>150 chars) sem verbo de ação
  ↓
State: idle → awaiting_context
  ↓
Bot: "🤔 Hmm, interessante! Isso é uma nota, filme, série ou outra coisa?
      1. 💡 Salvar como nota
      2. 🎬 Salvar como filme
      3. 📺 Salvar como série
      4. 🔗 Salvar como link
      5. ❌ Cancelar"
  ↓
User: "1"
  ↓
System: processa escolha → forcedType='note'
  ↓
State: awaiting_context → awaiting_confirmation
  ↓
Bot: "✅ Entendido! Deseja salvar como nota?"
  ↓
User: "sim"
  ↓
System: executa save_note(originalMessage)
  ↓
State: awaiting_confirmation → idle
  ↓
Bot: "✅ Nota salva com sucesso!"
```

## Alternativas Consideradas

### 1. LLM Decide Tudo (status quo v0.2.x)
**Rejeita**: Imprevisível, caro, difícil debugar (ver ADR-011).

### 2. Sempre Pedir Confirmação
**Rejeita**: UX ruim para casos óbvios ("salva inception" não precisa confirmar).

### 3. Heurística Complexa de Detecção
**Rejeita**: Frágil, muitas edge cases, difícil manter.

### 4. Machine Learning para Classificação
**Rejeita**: Overkill para MVP, requer treinamento/manutenção.

## Validação

**Como testar se funciona**:
1. Mensagem longa (>150 chars) sem verbo → solicita clarificação
2. Mensagem com "salva inception" → não solicita clarificação
3. Escolha "1" → confirma tipo "nota"
4. Escolha "5" → cancela operação
5. Escolha inválida ("abc") → pede escolha válida novamente

**Testes unitários**: `src/tests/clarification-flow.test.ts`

## Compatibilidade

- **Breaking change**: Não (novo fluxo é opt-in via detecção)
- **Migration**: Não necessária (funcionalidade nova)
- **Backward compat**: Sim (mensagens claras continuam funcionando)

## TODOs Futuros

1. **Multi-provider support**: Abstrair `whatsappService` para suportar Telegram/Discord.
2. **Timeouts**: Auto-cancelar clarificação após N minutos sem resposta.
3. **ML-based detection**: Melhorar detecção de ambiguidade com modelo treinado.
4. **A/B testing**: Medir se clarificação melhora satisfação do usuário.

## Referências

- [ADR-004: State Machine](004-state-machine.md) - Estados de conversação
- [ADR-011: Controle Determinístico](011-deterministic-runtime-control.md) - Runtime controla fluxo
- [ARQUITETURA-v0.3.0.md](../ARQUITETURA-v0.3.0.md) - Diagrama de estados
- Padrão de Anamnese Médica (triagem por níveis de especialização)

## Métricas de Sucesso

- ✅ 0 erros de classificação em mensagens longas (testado manualmente)
- ✅ 100% escolhas válidas processadas corretamente
- ✅ Logs estruturados em todos os pontos críticos
- ✅ Testes unitários cobrindo fluxo completo

---

**Versão**: v0.4.0  
**Data de implementação**: 16 de janeiro de 2026  
**Status**: ✅ Implementado
