# ADR-016: Session Key Architecture

**Status**: accepted

**Data**: 2026-02-16

## Contexto

O NEXO AI suporta múltiplos canais de comunicação (Telegram, Discord, WhatsApp, Web) e precisa:

1. **Isolar conversas** entre diferentes usuários e contextos
2. **Suportar grupos** onde o bot pode ser mencionado
3. **Rastrear sessões** para debugging e analytics
4. **Escalabilidade** para múltiplas contas por canal

Modelos anteriores usavam apenas `conversationId` que não capturava a complexidade de:
- Qual plataforma o usuário está usando
- Se é mensagem direta ou de grupo
- Qual conta (multi-account) está processando

## Decisão

Adotar o padrão **OpenClaw Session Keys** com formato hierárquico:

```
agent:{agentId}:{channel}:{accountId}:{peerKind}:{peerId}
```

### Componentes do Session Key

| Componente | Descrição | Exemplo |
|-------------|-----------|---------|
| `agent` | Prefixo fixo (constante) | `agent` |
| `agentId` | Identificador do agente (default: `main`) | `main`, `dev` |
| `channel` | Plataforma de mensageria | `telegram`, `discord`, `whatsapp`, `web` |
| `accountId` | ID da conta (opcional, para multi-account) | `bot12345` |
| `peerKind` | Tipo de peer | `direct`, `group`, `channel` |
| `peerId` | ID do peer (userId, groupId, channelId) | `+1234567890`, `987654321` |

### Exemplos Práticos

```
agent:main:telegram:direct:+1234567890       # DM Telegram
agent:main:discord:guild:123456789:channel:987654321  # Canal Discord
agent:main:whatsapp:direct:user123            # DM WhatsApp
agent:dev:web:direct:session-uuid               # Web chat (dev)
```

### Escopos de Isolamento (dmScope)

Para mensagens diretas, definimos escopos de isolamento:

| Scope | Descrição |
|-------|-----------|
| `main` | Todas as DMs compartilham a mesma sessão global |
| `per-peer` | Cada peer tem sua própria sessão (default) |
| `per-channel-peer` | Sessão única por canal+peer |
| `per-account-channel-peer` | Sessão única por conta+canal+peer |

### Tabela de Sessões

Nova tabela `agent_sessions`:

```sql
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key VARCHAR(500) NOT NULL UNIQUE,
  agent_id VARCHAR(100) DEFAULT 'main',
  channel VARCHAR(50) NOT NULL,
  account_id VARCHAR(100),
  peer_kind VARCHAR(20) NOT NULL,
  peer_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id),
  conversation_id UUID REFERENCES conversations(id),
  model VARCHAR(100),
  thinking_level VARCHAR(20),
  dm_scope VARCHAR(50) DEFAULT 'per-peer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Consequências Positivas

### 1. Rastreamento Preciso

```typescript
// Listar todas as sessões de um usuário
const sessions = await getUserSessions(userId);

// Encontrar sessão ativa para um peer
const session = await getActiveSession('telegram', 'direct', '+1234567890');
```

### 2. Debugging Melhorado

Session keys fornecem contexto imediato no log:

```
[INFO] Session: agent:main:telegram:direct:+1234567890
[INFO] User: +1234567890 → 4 messages, last: 5min ago
```

### 3. Multi-Account Suporte

Sistema pode rodar múltiplos bots Telegram/WhatsApp naturalmente:

```
agent:main:telegram:12345:direct:+9876543210  # Bot @bot_main
agent:main:telegram:67890:direct:+9876543210  # Bot @bot_support
```

### 4. Isolamento de Grupos

Cada grupo tem sua própria sessão, evitando vazamento de contexto:

```
agent:main:telegram:group:-1001234567890  # Grupo Família
agent:main:telegram:group:-1009876543210  # Grupo Trabalho
```

## Implementação

### Funções Auxiliares

```typescript
// Criar session key
buildSessionKey({
  agentId: 'main',
  channel: 'telegram',
  accountId: 'bot123',
  peerKind: 'direct',
  peerId: '+1234567890',
})
// → "agent:main:telegram:bot123:direct:+1234567890"

// Parse session key
parseSessionKey("agent:main:telegram:direct:+1234567890")
// → { agentId: 'main', channel: 'telegram', peerKind: 'direct', peerId: '+1234567890' }
```

### Integração com Adapters

```typescript
// Telegram adapter
const sessionKey = buildSessionKey({
  channel: 'telegram',
  peerKind: message.chat.type === 'private' ? 'direct' : 'group',
  peerId: message.chat.id.toString(),
});

// Discord adapter
const sessionKey = buildSessionKey({
  channel: 'discord',
  peerKind: message.channel.isDMBased() ? 'direct' : 'group',
  peerId: message.channelId,
});
```

## Trade-offs

### Prós

- ✅ **Formato legível**: Session keys são human-readable
- ✅ **Escalável**: Suporta múltiplos canais e contas
- ✅ **Debugável**: Contexto imediato nos logs
- ✅ **Flexível**: Fácil adicionar novos componentes

### Contras

- ⚠️ **Complexidade inicial**: Mais complexo que `conversationId` simples
- ⚠️ **Tamanho máximo**: Session keys podem ficar longas ( mitigado por `VARCHAR(500)`)
- ⚠️ **Migração**: Sessões existentes precisam ser migradas

## Alternativas Consideradas

### 1. UUID Simples

```
conversation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**Problemas**:
- Não captura canal/peer
- Difícil debugar
- Não escalar bem com grupos

### 2. JSON Armazenado

```json
{
  "channel": "telegram",
  "peerType": "direct",
  "peerId": "+1234567890"
}
```

**Problemas**:
- Não legível em logs
- Mais lento para queries
- Não suporta busca prefixada

## Referências

- OpenClaw: https://github.com/openclaw/openclaw
- OpenClaw Session Keys: https://deepwiki.com/openclaw/openclaw/docs/session-keys
- ADR-011: Controle Runtime Determinístico
- ADR-007: Multi-Provider Support

## Status da Implementação

| Componente | Status |
|-----------|--------|
| Tabela `agent_sessions` | ✅ Criada |
| Session Service | ✅ Implementado (`/services/session-service.ts`) |
| Telegram Adapter | ✅ Integrado |
| Discord Adapter | ✅ Integrado |
| Transcripts JSONL | ✅ Suportado |
| Daily Logs | ✅ Suportado |
