# Guia de Testes - Intent Classifier

## Casos de Teste do Intent Classifier

Este documento lista os casos de teste para validar o comportamento do classificador de intenções.

### ✅ Casos que DEVEM ser detectados

#### 1. save_content

**Descrições longas (>80 chars) sem pergunta:**

```
"Aplicativo over screen que conecta no spotify e permite adicionar a musica atual a várias playlists"
→ Intent: save_content
→ Motivo: >80 chars + não tem "?" + tem "aplicativo"
```

**Com palavra-chave explícita:**

```
"salva clube da luta"
"quero assistir inception"
"anota essa série"
→ Intent: save_content
```

**Referência ao anterior:**

```
"salva ai"
"guarda isso"
"anota aí"
→ Intent: save_content
→ refersToPrevious: true
```

**URL:**

```
"https://youtube.com/watch?v=abc123"
→ Intent: save_content
→ entities.url: "https://youtube.com/watch?v=abc123"
```

**Streaming + conteúdo:**

```
"vi no netflix que tem avatar, quero assistir"
→ Intent: save_content
→ Motivo: tem "netflix" + "quero assistir"
```

#### 2. search_content

**Buscas explícitas (<100 chars):**

```
"o que eu salvei"
"mostra meus filmes"
"lista séries de terror"
→ Intent: search_content
```

**NÃO deve detectar como search se >100 chars:**

```
"Aplicativo over screen que conecta no spotify e permite adicionar a musica atual a várias playlists e fazer diversas outras coisas"
→ Intent: save_content (não search, pois >100 chars)
```

#### 3. confirm

**Confirmações simples:**

```
"sim"
"ok"
"confirmo"
"1"
"o primeiro"
"a segunda"
→ Intent: confirm
```

**Com pontuação:**

```
"sim!"
"ok."
→ Intent: confirm
```

#### 4. deny

**Negações:**

```
"não"
"cancela"
"deixa pra lá"
→ Intent: deny
```

#### 5. get_info

**Pedidos de informação:**

```
"o que é interstellar"
"quem é christopher nolan"
"me fala sobre matrix"
→ Intent: get_info
```

#### 6. casual_chat

**Saudações:**

```
"oi"
"olá"
"bom dia"
"obrigado"
"tchau"
→ Intent: casual_chat
```

#### 7. unknown

**Casos ambíguos (deixar para LLM):**

```
"clube da luta"
→ Intent: unknown
→ Motivo: curto, sem contexto, sem palavra-chave
```

```
"eu estava pensando se você poderia me ajudar com algo relacionado a filmes mas não sei bem o quê"
→ Intent: unknown
→ Motivo: tem "estava pensando", "não sei" = dúvida
```

---

## Regras de Classificação

### 1. Ordem de Checagem

1. **Confirmação/Negação** (mais específico)
2. **Busca** (se <100 chars + keywords)
3. **Info Request** (perguntas explícitas)
4. **Save Content** (várias heurísticas)
5. **Casual Chat** (saudações)
6. **Unknown** (fallback para LLM)

### 2. Heurísticas de Save Content

| Condição                                                 | Exemplo                                            | Detectado?                         |
| -------------------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| >80 chars + sem "?" + sem words de dúvida + tem conteúdo | "Aplicativo over screen que conecta no spotify..." | ✅ save_content                    |
| <50 chars + sem "?" + sem words de dúvida + tem conteúdo | "clube da luta"                                    | ❌ unknown (deixa LLM decidir)     |
| URL presente                                             | "https://youtube.com/..."                          | ✅ save_content                    |
| "salva ai", "guarda isso"                                | "salva ai"                                         | ✅ save_content (refersToPrevious) |
| Keywords explícitas                                      | "quero assistir inception"                         | ✅ save_content                    |
| Streaming + conteúdo + não-pergunta                      | "vi no netflix que tem avatar, quero assistir"     | ✅ save_content                    |

### 3. Palavras de Dúvida

Detectadas por `hasQuestionWords()`:

- estava pensando
- poderia
- será
- talvez
- não sei
- ajuda / ajudar
- como / quando / onde / por que / pra que

**Efeito:** Se mensagem >80 chars tem essas palavras → **unknown** (não save_content)

### 4. Normalização

- **Case insensitive**: "SIM" = "sim"
- **Remove pontuação**: "sim!" = "sim"
- **Trim**: " ok " = "ok"

---

## Testes Manuais

Para testar manualmente no terminal:

```bash
bun -e "
import {intentClassifier} from './src/services/intent-classifier';
const msg = 'SUA MENSAGEM AQUI';
const result = intentClassifier.classify(msg);
console.log(JSON.stringify(result, null, 2));
"
```

### Exemplos:

```bash
# Teste 1: Descrição longa
bun -e "
import {intentClassifier} from './src/services/intent-classifier';
const r = intentClassifier.classify('Aplicativo over screen que conecta no spotify e permite adicionar a musica atual a várias playlists');
console.log('Intent:', r.intent, '| Confidence:', r.confidence);
"
# Esperado: Intent: save_content | Confidence: 0.9

# Teste 2: Título curto (ambíguo)
bun -e "
import {intentClassifier} from './src/services/intent-classifier';
const r = intentClassifier.classify('clube da luta');
console.log('Intent:', r.intent, '| Confidence:', r.confidence);
"
# Esperado: Intent: unknown | Confidence: 0.5
# Motivo: Deixa LLM decidir se é save ou outro

# Teste 3: Busca
bun -e "
import {intentClassifier} from './src/services/intent-classifier';
const r = intentClassifier.classify('mostra meus filmes');
console.log('Intent:', r.intent, '| Query:', r.entities?.query);
"
# Esperado: Intent: search_content | Query: "meus filmes"

# Teste 4: Salva anterior
bun -e "
import {intentClassifier} from './src/services/intent-classifier';
const r = intentClassifier.classify('salva ai');
console.log('Intent:', r.intent, '| Refers to previous:', r.entities?.refersToPrevious);
"
# Esperado: Intent: save_content | Refers to previous: true
```

---

## Cobertura de Testes

Rodando `bun test src/tests/intent-classifier.test.ts`:

- ✅ 44 testes passando
- ✅ 59 assertions
- ✅ Cobertura:
  - Confirmações (5 testes)
  - Negações (3 testes)
  - Buscas (4 testes)
  - Info requests (4 testes)
  - Save content (9 testes)
  - Casual chat (5 testes)
  - Unknown (2 testes)
  - Edge cases (4 testes)
  - Confiança (3 testes)
  - Extração de entidades (5 testes)

---

## Debugging

Se o classifier errar, verificar:

1. **Comprimento da mensagem** (`msg.length`)
2. **Presença de "?"** ou palavras de dúvida
3. **Keywords detectadas** (streaming, conteúdo, etc)
4. **Ordem de checagem** (confirmação antes de save, etc)

Adicionar logs temporários em `intent-classifier.ts`:

```typescript
console.log('[DEBUG]', {
	msgLength: msg.length,
	hasQuestionMark: msg.includes('?'),
	hasQuestionWords: this.hasQuestionWords(msg),
	mentionsContent,
	isLongDescription,
});
```
