# ADR-012: Vitest como Framework de Testes

**Status**: accepted  
**Data**: 2025-01-15  
**Atualizado**: 2026-02-01  
**Nota**: decisão original era usar Bun Test; migrou para Vitest junto com a migração de Bun → Node.js + tsx.

## Contexto

O projeto migrou de Bun para **Node.js + tsx** como runtime. Precisávamos de um framework de testes que:
1. Funcione com Node.js e tsx
2. Seja rápido e com HMR em watch mode
3. Suporte TypeScript nativamente sem configuração extra
4. Tenha API compatível com Jest (curva de aprendizado baixa)
5. Integre bem com o ecossistema monorepo

## Decisão

Usar **Vitest** como framework de testes do projeto (API e Dashboard).

### Estrutura de Testes

```
apps/api/src/tests/
├── intent-classifier.test.ts  # Classificação de intenções (78 casos)
├── ai-fallback.test.ts        # Fallback entre providers AI
└── api.test.ts                # Endpoints HTTP
```

### Padrão de Escrita

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { IntentClassifier } from '@/services/intent-classifier';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;

  beforeAll(async () => {
    classifier = new IntentClassifier();
    await classifier.initialize();
  });

  it('detecta "sim" como confirm', async () => {
    const result = await classifier.classify('sim');
    expect(result.intent).toBe('confirm');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
```

### Comandos

```bash
# Rodar todos os testes
pnpm test

# Arquivo específico
pnpm test -- src/tests/intent-classifier.test.ts

# Modo watch
pnpm test:watch

# UI interativa
pnpm test:ui
```

## Consequências

### Positivas

1. **Compatível com Node.js**: sem necessidade de Bun runtime
2. **TypeScript nativo**: resolve paths aliases (`@/`) automaticamente via `vitest.config.ts`
3. **API Jest-compatible**: `describe`, `it`, `expect`, `vi.mock()` — zero curva de aprendizado
4. **Hot reload excelente**: `--watch` com HMR rápido
5. **UI interativa**: `--ui` para debugging visual de testes

### Negativas

1. **Dependência extra**: não é built-in (mas é uma dependência dev padrão)
2. **Coverage**: requer `@vitest/coverage-v8` separado

## Convenções do Projeto

1. **Nomenclatura**: `*.test.ts` (não `.spec.ts`)
2. **Localização**: `src/tests/` 
3. **Imports**: de `vitest` (não `bun:test`)
4. **Mocks**: usar `vi.mock()` e `vi.fn()`
5. **Async**: `async/await` em todos os testes assíncronos

## Referências

- [Vitest Documentation](https://vitest.dev/)
- `apps/api/vitest.config.ts` — configuração
- `apps/api/src/tests/` — testes do projeto
