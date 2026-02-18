# ADR 001: Message Analysis Architecture

**Status:** Accepted  
**Date:** 2026-01-22  
**Authors:** Nexo AI Team

---

## Context

O Nexo AI precisa analisar mensagens de usuários para:

- Detectar intenções (salvar, buscar, deletar)
- Identificar ambiguidade
- Analisar sentimento
- Detectar conteúdo ofensivo/spam
- **Detectar tom (imperativo vs educado)**

### Problema

Usando LLM para todas as análises:

- ❌ **Latência alta** (~500ms por análise)
- ❌ **Custo elevado** (dezenas de milhares de requisições/mês)
- ❌ **Dependência de internet/API**
- ❌ **Difícil de debugar** (black box)

## Decision

Criar arquitetura **híbrida** usando:

1. **nlp.js** (neural + regex) para análises simples/rápidas
2. **LLM** (Cloudflare/Gemini) apenas para casos complexos

### Estrutura: `src/services/message-analysis/`

```
message-analysis/
├── analyzers/
│   ├── base-analyzer.ts          # Classe abstrata
│   ├── ambiguity-analyzer.ts     # ✅ Implementado
│   ├── profanity-analyzer.ts     # ✅ Implementado
│   ├── spam-analyzer.ts          # ✅ Implementado
│   └── tone-analyzer.ts          # 🚧 A implementar
├── training/
│   ├── training-data.ts          # 278 exemplos PT-BR
│   ├── nexo-trainer.ts           # Treinamento neural
│   └── model/nexo-model.nlp      # Modelo treinado (363KB)
├── types/
│   └── analysis-result.types.ts  # Tipos TypeScript
├── constants/
│   └── clarification-messages.ts # Mensagens i18n
└── message-analyzer.service.ts   # Orquestrador principal
```

---

## Principles

### 1. BaseAnalyzer Pattern

**TODOS** os analisadores DEVEM estender `BaseAnalyzer`:

```typescript
export abstract class BaseAnalyzer<T extends BaseAnalysisResult> {
	protected abstract readonly analyzerType: AnalysisType;

	abstract analyze(message: string, language: Language): T;

	protected validateInput(message: string): void {
		if (!message || message.trim().length === 0) {
			throw new Error('Message cannot be empty');
		}
	}

	protected normalizeMessage(message: string): string {
		return message.trim();
	}

	protected createBaseResult(confidence: number): BaseAnalysisResult {
		return {
			type: this.analyzerType,
			timestamp: new Date(),
			confidence,
		};
	}
}
```

### 2. Quando usar nlp.js vs LLM

| Critério                   | nlp.js                    | LLM                      |
| -------------------------- | ------------------------- | ------------------------ |
| **Padrões fixos**          | ✅ Regex, palavrões, spam | ❌                       |
| **Classificação treinada** | ✅ Intenções PT-BR        | ❌                       |
| **Contexto complexo**      | ❌                        | ✅ Ambiguidade semântica |
| **Respostas naturais**     | ❌                        | ✅ Geração de texto      |
| **Latência**               | ~10ms                     | ~500ms                   |
| **Custo**                  | $0                        | ~$0.001/req              |

**Regra de Ouro:** Se pode ser resolvido com **padrões/treino**, use nlp.js. Se precisa de **raciocínio/contexto**, use LLM.

### 3. Como Adicionar Novo Analisador

**Exemplo: ToneAnalyzer**

1️⃣ **Criar analisador** estendendo `BaseAnalyzer`:

```typescript
// analyzers/tone-analyzer.ts
import { BaseAnalyzer } from './base-analyzer.js';
import { ToneAnalysisResult, Language } from '../types/analysis-result.types.js';

export class ToneAnalyzer extends BaseAnalyzer<ToneAnalysisResult> {
	protected readonly analyzerType = 'tone' as const;

	analyze(message: string, language: Language = 'pt'): ToneAnalysisResult {
		this.validateInput(message);
		const normalized = this.normalizeMessage(message).toLowerCase();

		// Lógica de análise (regex, nlp.js, etc)
		const isQuestion = message.trim().endsWith('?');
		const isImperative = /^(mude|renomeie|configure)/i.test(normalized);

		return {
			type: 'tone',
			timestamp: new Date(),
			confidence: 0.85,
			tone: isImperative ? 'imperative' : 'question',
			isQuestion,
		};
	}
}
```

2️⃣ **Adicionar tipo** em `types/analysis-result.types.ts`:

```typescript
export interface ToneAnalysisResult extends BaseAnalysisResult {
	type: 'tone';
	tone: MessageTone;
	isQuestion: boolean;
}
```

3️⃣ **Integrar** no `MessageAnalyzerService`:

```typescript
export class MessageAnalyzerService {
	private toneAnalyzer: ToneAnalyzer;

	constructor() {
		this.toneAnalyzer = new ToneAnalyzer();
	}

	checkTone(message: string, language: Language = 'pt') {
		return this.toneAnalyzer.analyze(message, language);
	}
}
```

---

## Consequences

### Benefícios

✅ **Performance:** ~10ms vs ~500ms (50x mais rápido)  
✅ **Custo:** $0 vs ~$100/mês em produção  
✅ **Offline:** Funciona sem internet (modelo local)  
✅ **Debugável:** Logs claros, comportamento previsível  
✅ **Extensível:** Fácil adicionar novos analisadores

### Trade-offs

⚠️ **Precisão:** nlp.js = 95-100% em casos treinados, LLM = 98%+ em casos complexos  
⚠️ **Manutenção:** Precisa re-treinar modelo ao adicionar exemplos  
⚠️ **Idiomas:** Requer treino por idioma (atualmente PT-BR e EN)

### Quando Revisitar

- Se precisão do nlp.js cair abaixo de 90%
- Se surgir necessidade de suportar 5+ idiomas
- Se análises ficarem muito complexas (ex: sarcasmo, ironia)

---

## Implementation Status

| Analyzer          | Status  | Lines | Confidence |
| ----------------- | ------- | ----- | ---------- |
| AmbiguityAnalyzer | ✅ Done | 120   | 70-90%     |
| ProfanityAnalyzer | ✅ Done | 144   | 95%        |
| SpamAnalyzer      | ✅ Done | 97    | 85-90%     |
| ToneAnalyzer      | 🚧 WIP  | -     | -          |
| Neural Classifier | ✅ Done | -     | 85-100%    |

**Training Data:** 278 exemplos PT-BR  
**Model Size:** 363KB  
**Training Time:** ~64ms

---

## References

- [nlp.js Documentation](https://github.com/axa-group/nlp.js)
- [PARTE 1: Neural Classifier Implementation](../brain/e5df80e5-bccb-445c-8937-6dfe4a72aa91/)
- [PARTE 2: Additional Analyzers + Hybrid Approach](../brain/e5df80e5-bccb-445c-8937-6dfe4a72aa91/)
