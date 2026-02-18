# OpenClaw Patterns for NEXO AI

## Overview

Este guia documenta como os padrões do [OpenClaw](https://github.com/openclaw/openclaw) foram adaptados e implementados no NEXO AI.

**OpenClaw** é um framework de agentes AI que usa:
- Arquivos `.md` para personalidade e contexto
- Session keys hierárquicos para roteamento
- Busca semântica + híbrida para memória
- Diários (daily logs) para rastreamento

## Tabela de Conteúdo

1. [Agent Profiles](#agent-profiles)
2. [Session Keys](#session-keys)
3. [Memory Search](#memory-search)
4. [Daily Logs](#daily-logs)
5. [Adapters](#adapters)

## Agent Profiles

OpenClaw usa arquivos Markdown para configurar o agente. NEXO adaptou isso para banco de dados.

### Estrutura de Perfis

```
agent_memory_profiles (BD)
├── agents_content    → AGENTS.md
├── soul_content      → SOUL.md
├── identity_content  → IDENTITY.md
├── user_content      → USER.md
├── tools_content     → TOOLS.md
└── memory_content    → MEMORY.md
```

### SOUL.md - Personalidade

Define o tom de voz, vibe e estilo de comunicação:

```markdown
Você é um assistente amigável e caloroso. Usa emojis moderadamente.
Gosta de fazer perguntas sobre o dia do usuário.
Linguagem simples e acessível, evitando jargão técnica excessiva.
```

**Exemplos prontos**:

- **Friendly**: Tom caloroso, emojis moderados, perguntas sobre o usuário
- **Professional**: Direto, objetivo, sem emojis, eficiente
- **Gamer**: Gírias de gaming ("gg", "carregou"), referências a jogos
- **Scholar**: Tom acadêmico, referências bibliográficas, citações

### IDENTITY.md - Identidade Visual

Nome, emoji e creature do assistente:

```markdown
Nome: Sparkle
Emoji: 🦊
Creature: Fox
```

**Creatures populares**:
- 🦊 Fox - Amigável, esperto
- 🦉 Owl - Sábio, observador
- 🤖 Robot - Tecnológico, preciso
- 🐱 Dog - Leal, companheiro

### USER.md - Perfil do Usuário

Informações sobre o humano (usado **apenas em DMs**):

```markdown
Nome: João
Interesses: Ficção científica, tecnologia, culinária
Prefere: Respostas concisas
Apetências: Filmes com direção de Christopher Nolan
```

⚠️ **Privacidade**: Este conteúdo **NUNCA** é injetado em grupos ou canais públicos.

### Injeção Dinâmica de Contexto

O `context-builder.ts` monta o prompt baseado na sessão:

| Seção | DM | Grupo | Main | Sessão |
|-------|----|----|----|---------|
| SOUL | ✅ | ✅ | ✅ | ✅ |
| IDENTITY | ✅ | ✅ | ✅ | ✅ |
| AGENTS | ✅ | ✅ | ✅ | ✅ |
| USER | ✅ | ❌ | ✅ | ❌ |
| MEMORY | ❌ | ❌ | ✅ | ❌ |

## Session Keys

Formato hierárquico para roteamento de mensagens:

```
agent:{agentId}:{channel}:{accountId}:{peerKind}:{peerId}
```

### Exemplos

```
agent:main:telegram:direct:+1234567890
agent:main:discord:guild:123456789:channel:987654321
agent:dev:whatsapp:direct:user123
agent:main:web:direct:session-uuid
```

### Componentes

| Parte | Descrição |
|------|-----------|
| `agent` | Prefixo fixo |
| `agentId` | ID do agente (default: `main`) |
| `channel` | `telegram`, `discord`, `whatsapp`, `web` |
| `accountId` | Opcional, para multi-account |
| `peerKind` | `direct`, `group`, `channel` |
| `peerId` | userId, groupId, channelId |

### Escopos de Isolamento

- **`main`**: Todas DMs compartilham a mesma sessão global
- **`per-peer`** (default): Cada peer tem sua própria sessão
- **`per-channel-peer`**: Sessão única por canal+peer
- **`per-account-channel-peer`**: Sessão única por conta+canal+peer

### Implementação

```typescript
// Criar session key
import { buildSessionKey } from '@/services/session-service';

const sessionKey = buildSessionKey({
  agentId: 'main',
  channel: 'telegram',
  peerKind: 'direct',
  peerId: '+1234567890',
});
// → "agent:main:telegram:direct:+1234567890"

// Parse session key
import { parseSessionKey } from '@/services/session-service';

const parts = parseSessionKey("agent:main:telegram:direct:+1234567890");
// → { agentId: 'main', channel: 'telegram', peerKind: 'direct', peerId: '+1234567890' }
```

## Memory Search

Busca híbrida combinando **similaridade semântica** (pgvector) e **palavras-chave** (PostgreSQL FTS).

### Estratégia Híbrida

```typescript
// Configuração padrão
const config = {
  vectorWeight: 0.7,  // 70% semântica
  textWeight: 0.3,    // 30% palavras-chave
  mergeStrategy: 'weighted',
};

// Busca
const results = await searchMemory({
  query: "filmes de ficção científica",
  userId,
  maxResults: 10,
  minScore: 0.3,
  config,
});
```

### Como Funciona

1. **Vector Search**: Encontra "Interstellar", "Matrix" (mesmo que usuário digitou errado)
2. **Keyword Search**: Encontra títulos exatos ("Matrix", "Interestelar")
3. **Merge**: Combina scores com pesos
4. **Re-rank**: Ordena por score final

### Configuração por Tipo

```typescript
// Filmes precisam de match exato
const movieConfig = { vectorWeight: 0.8, textWeight: 0.2 };

// Notas podem ter sobreposição semântica
const noteConfig = { vectorWeight: 0.6, textWeight: 0.4 };
```

### Tools para o Agente

O LLM pode usar a busca de memória:

```typescript
// No fluxo do agente
const results = await memory_search({
  query: "o que o usuário gosta?",
  userId,
  maxResults: 5,
});

// O LLM recebe os resultados e pode personalizar respostas
```

## Daily Logs

Registros diários das atividades do agente (padrão "heartbeat" do OpenClaw).

### Estrutura

```sql
agent_daily_logs (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  log_date VARCHAR(10),  -- YYYY-MM-DD
  content TEXT,
  created_at TIMESTAMPTZ
)
```

### Uso

```typescript
// Criar/atualizar log do dia
await upsertDailyLog({
  userId: 'user-123',
  date: '2026-02-16',
  content: `
    - 47 conversas processadas
    - 142 itens salvos
    - 3 novos usuários
    - Problema: timeout em 2 sessões
  `,
});
```

### Dashboard

Página `/profile/daily-logs` permite:
- Visualizar logs por data
- Editar logs manuais
- Navegar entre datas
- Ver estatísticas

## Adapters

### Telegram

**Implementado**:
- ✅ Mensagens diretas
- ✅ Grupos com mention gating (@bot)
- ✅ Botões inline
- ✅ Comandos de chat
- ✅ Typing indicators

**Mention Gating**:
```typescript
// Apenas processa mensagens em grupos se bot for mencionado
if (isGroupMessage && !botMentioned) {
  return null; // Ignora mensagem
}
```

### Discord

**Implementado**:
- ✅ Mensagens diretas
- ✅ Canais e grupos com menção
- ✅ Slash commands (/status, /new, /memory, etc)
- ✅ Botões e select menus
- ✅ Thread support
- ✅ Media support (imagens, arquivos)

**Exemplo de Slash Command**:
```typescript
// /memory query:filmes
interaction.options.getString('query');
```

### Web Chat

**A implementar**:
- Chat em tempo real
- Session key via WebSocket
- Typing indicators
- File uploads

## Diferenças OpenClaw vs NEXO

| Aspecto | OpenClaw | NEXO AI |
|---------|----------|----------|
| **Armazenamento** | Arquivos .md | Banco de dados |
| **Múlti-user** | Single-user | Multi-user |
| **Session routing** | Session keys | Session keys + conversas |
| **Busca** | sqlite-vec local | pgvector + PostgreSQL FTS |
| **LLM Control** | Chat livre | Determinístico (ADR-011) |
| **UI** | CLI | Web + Telegram + Discord |

## API Reference

### Session Service

```typescript
// Criar ou buscar sessão
const session = await getOrCreateSession({
  channel: 'telegram',
  peerKind: 'direct',
  peerId: '+1234567890',
});

// Vincular ao usuário
await linkSessionToUser(session.sessionKey, userId, conversationId);
```

### Context Builder

```typescript
import { buildAgentContext } from '@/services/context-builder';

const context = await buildAgentContext(userId, sessionKey);
// → { systemPrompt: "You are NEXO...", ... }
```

### Memory Search

```typescript
import { searchMemory } from '@/services/memory-search';

const results = await searchMemory({
  query: 'filmes de ação',
  userId,
  config: { vectorWeight: 0.8, textWeight: 0.2 },
});
```

## Exemplos Práticos

### Exemplo 1: Configurar Personalidade "Gamer"

1. Acessar `/profile/personality`
2. Aba "Personalidade"
3. Colar template "Gamer"
4. Salvar

**Resultado**: Respostas do bot passam a ser "GG! Filme salvo, 10/10!"

### Exemplo 2: Debugar Sessão

1. Acessar `/admin/sessions`
2. Buscar por session key
3. Ver detalhes da sessão
4. Exportar JSONL

### Exemplo 3: Buscar Memória

**Input**: "oque eu salvei essa semana?"

```typescript
// O agente usa a tool memory_search
const results = await searchMemory({
  query: 'semana',
  userId,
  maxResults: 10,
});

// Filtra resultados da última semana
const thisWeek = results.filter(r => {
  const date = new Date(r.metadata.date);
  const daysAgo = (now - date) / (1000 * 60 * 60 * 24);
  return daysAgo <= 7;
});
```

## Roadmap

### ✅ Implementado (Fase 1-5)

- [x] Agent profiles (BD)
- [x] Session keys
- [x] Telegram adapter completo
- [x] Discord adapter completo
- [x] Chat commands
- [x] Hybrid search
- [x] Context builder
- [x] Daily logs
- [x] Dashboard UI

### 🚧 Futuro (Fase 7+)

- [ ] Web chat com WebSocket
- [ ] Voice message transcription (Telegram/Discord)
- [ ] Learning to Rank (ajuste automático de pesos)
- [ ] A/B testing de personalidades
- [ ] Export/Import de perfis (Markdown)
- [ ] Multi-language suporte

## Referências

- OpenClaw: https://github.com/openclaw/openclaw
- OpenClaw DeepWiki: https://deepwiki.com/openclaw/openclaw
- ADR-016: Session Key Architecture
- ADR-017: Agent Profile System
- ADR-018: Hybrid Memory Search
- ADR-011: Controle Runtime Determinístico
