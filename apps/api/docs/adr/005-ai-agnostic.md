# ADR-005: Arquitetura AI-Agnostic

**Status**: accepted

**Data**: 2026-01-05

## Contexto

LLM providers mudam rápido:

- Preços variam
- Features novas aparecem
- APIs mudam
- Queremos testar diferentes modelos

Risco: acoplar sistema a um provider específico.

## Decisão

Services **não sabem** qual LLM está sendo usado.

```
conversation-service → ai-service (interface) → claude-client
                                               → gemini-client
                                               → openai-client
```

## Consequências

### Positivas

- **Flexibilidade**: trocar LLM sem mudar services
- **A/B testing**: comparar providers facilmente
- **Fallback**: se Claude falha, usa Gemini
- **Custo**: otimizar por preço/performance

### Negativas

- **Abstraction leak**: features específicas (tools, vision) difíceis
- **Mais código**: adapter layer extra
- **Testing**: precisa mockar interface

## Implementação

```typescript
// Interface genérica
interface AIService {
  callLLM(params: {
    message: string;
    history: Message[];
    context: Context;
  }): Promise<AIResponse>;
}

// Implementações
class ClaudeService implements AIService { ... }
class GeminiService implements AIService { ... }

// Factory
function createAIService(provider: string): AIService {
  switch(provider) {
    case 'claude': return new ClaudeService();
    case 'gemini': return new GeminiService();
  }
}
```

## Alternativas Consideradas

1. **LangChain**: Pesado demais, abstractions ruins
2. **Vercel AI SDK**: Bom mas específico para streaming
3. **Acoplar ao Claude**: Mais rápido inicialmente, problem futuro
