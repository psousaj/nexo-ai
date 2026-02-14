# ADR-012: Bun Test como Framework de Testes

**Status**: accepted

**Data**: 2025-01-15

## Contexto

O projeto usa Bun como runtime JavaScript. Precisávamos escolher um framework de testes que:

1. Tenha integração nativa com Bun
2. Seja rápido e leve
3. Não adicione dependências extras
4. Suporte TypeScript nativamente
5. Tenha API familiar para desenvolvedores

## Decisão

Usar **Bun Test** (`bun:test`) como framework de testes único do projeto.

### Estrutura de Testes

```
src/tests/
├── intent-classifier.test.ts  # Classificação de intenções
├── ai-fallback.test.ts        # Fallback entre providers AI
├── api.test.ts                # Endpoints HTTP
```

### Padrão de Escrita

```typescript
import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';

describe('NomeDoModulo', () => {
  beforeAll(() => {
    // Setup antes de todos os testes
  });

  describe('funcionalidade específica', () => {
    test('deve fazer X quando Y', async () => {
      const result = await funcao();
      expect(result).toBe(esperado);
    });
  });
});
```

### Comandos

```bash
# Rodar todos os testes
bun test

# Rodar arquivo específico
bun test src/tests/intent-classifier.test.ts

# Modo watch
bun test --watch

# Com coverage (experimental)
bun test --coverage
```

## Consequências

### Positivas

1. **Zero dependências**: `bun:test` é built-in
2. **Performance**: 10-20x mais rápido que Jest
3. **TypeScript nativo**: Sem configuração de transpilação
4. **API familiar**: Sintaxe idêntica a Jest/Vitest
5. **Hot reload**: `--watch` funciona out-of-the-box
6. **Mocking integrado**: `mock()` disponível sem libs extras

### Negativas

1. **Ecossistema menor**: Menos plugins que Jest
2. **Coverage experimental**: `--coverage` ainda em desenvolvimento
3. **IDE support**: Menos extensões específicas

## Alternativas Consideradas

### 1. Jest

**Prós**: Ecossistema maduro, muita documentação
**Contras**: Lento, precisa babel/ts-jest, pesado

### 2. Vitest

**Prós**: Rápido, compatível com Jest
**Contras**: Dependência extra, otimizado para Vite

### 3. Node Test Runner

**Prós**: Built-in no Node
**Contras**: Usamos Bun, não Node

## Convenções do Projeto

1. **Nomenclatura**: `*.test.ts` (não `.spec.ts`)
2. **Localização**: `src/tests/` (não `__tests__/`)
3. **Imports**: Sempre de `bun:test`
4. **Async**: Usar `async/await` (não callbacks)
5. **Mocks**: Usar `mock()` do Bun para funções

## Exemplo Real

```typescript
// src/tests/intent-classifier.test.ts
import { describe, test, expect } from 'bun:test';
import { IntentClassifier } from '@/services/intent-classifier';

const classifier = new IntentClassifier();

describe('IntentClassifier', () => {
  describe('Confirmações', () => {
    test('detecta "sim"', async () => {
      const result = await classifier.classify('sim');
      expect(result.intent).toBe('confirm');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('detecta números (seleção)', async () => {
      const result = await classifier.classify('1');
      expect(result.intent).toBe('confirm');
      expect(result.entities?.selection).toBe(1);
    });
  });
});
```

## Referências

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [src/tests/](../../src/tests/) - Testes do projeto
