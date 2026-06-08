# ADR-017: Agent Profile System

**Status**: accepted

**Data**: 2026-02-16

## Contexto

O NEXO AI precisa suportar **personalização por usuário** de forma estruturada:

1. **Personalidade** do assistente (tom de voz, vibe, estilo)
2. **Identidade** visual (nome, emoji, creature)
3. **Instruções** específicas do workspace
4. **Perfil** do usuário humano
5. **Memória** de longo prazo
6. **Ferramentas** disponíveis

Modelos anteriores usavam apenas `assistantName` no banco de dados, insuficiente para:

- Sistemas complexos de personalidade
- Múltiplas personalidades em paralelo (ex: "profissional" vs "casual")
- Contexto dinâmico baseado no tipo de sessão

## Decisão

Adotar o padrão **OpenClaw Agent Profiles** baseado em arquivos `.md`:

```
AGENTS.md    # Instruções do workspace
SOUL.md      # Personalidade, tom de voz
IDENTITY.md  # Nome, creature, emoji
USER.md      # Perfil do usuário humano
TOOLS.md     # Documentação de ferramentas
MEMORY.md    # Memória de longo prazo
```

### Tabela de Perfis

Nova tabela `agent_memory_profiles`:

```sql
CREATE TABLE agent_memory_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  agents_content TEXT,     -- AGENTS.md
  soul_content TEXT,       -- SOUL.md
  identity_content TEXT,   -- IDENTITY.md
  user_content TEXT,       -- USER.md
  tools_content TEXT,      -- TOOLS.md
  memory_content TEXT,     -- MEMORY.md
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);
```

### Campos de Personalidade na Tabela Users

Campos adicionais em `users`:

```sql
ALTER TABLE users ADD COLUMN assistant_emoji TEXT;
ALTER TABLE users ADD COLUMN assistant_creature TEXT;
ALTER TABLE users ADD COLUMN assistant_tone VARCHAR(50);
ALTER TABLE users ADD COLUMN assistant_vibe TEXT;
```

## Sistema de Injeção de Contexto

### Regras de Injeção

| Seção | DM | Grupo | Main Session | Sessão Secundária |
|-------|----|----|--------------|-------------------|
| **SOUL** | ✅ | ✅ | ✅ | ✅ |
| **IDENTITY** | ✅ | ✅ | ✅ | ✅ |
| **AGENTS** | ✅ | ✅ | ✅ | ✅ |
| **USER** | ✅ | ❌ | ✅ | ❌ |
| **MEMORY** | ❌ | ❌ | ✅ | ❌ |

### Context Builder Service

```typescript
// services/context-builder.ts
export async function buildAgentContext(userId: string, sessionKey: string): Promise<AgentContext> {
  const profile = await db.query.agentMemoryProfiles.findFirst({
    where: eq(agent_memory_profiles.userId, userId)
  });

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  const isDirectMessage = sessionKey.includes(':direct:');
  const isMainSession = sessionKey.includes(':main:');

  // Build sections based on context
  const sections = [];

  // 1. Identity (always)
  sections.push(`You are ${user?.assistantName || 'NEXO'}, a personal AI assistant.`);
  if (profile?.soulContent) {
    sections.push(`\n## Personality\n${profile.soulContent}`);
  }

  // 2. USER.md (DMs only)
  if (isDirectMessage && profile?.userContent) {
    sections.push(`\n## User Profile\n${profile.userContent}`);
  }

  // 3. MEMORY.md (main session only)
  if (isMainSession && profile?.memoryContent) {
    sections.push(`\n## Long-term Memory\n${profile.memoryContent}`);
  }

  return {
    systemPrompt: sections.join('\n'),
    // ... individual sections
  };
}
```

## Exemplos Práticos

### Cenário A: Personalidade "Gamer"

**SOUL.md**:
```
Você é um assistente com vibe gamer. Usa gírias como "gg", "carregou", "achievement unlocked".
Referências a jogos são bem-vindas. Entusiasta em alta.
```

**Resposta**:
- Usuário: "Salva Interstellar"
- Bot: "GG! Interstellar salvo, cinematic masterpiece! 🎮🔥 9.0/10 would watch again."

### Cenário B: Personalidade "Profissional"

**SOUL.md**:
```
Você é um assistente profissional. Foca em eficiência e clareza.
Sem redundâncias, sem emojis. Comunicação direta e objetiva.
```

**Resposta**:
- Usuário: "Salva Interstellar"
- Bot: "Filme salvo. (2014, Christopher Nolan, 8.7/10)"

## Consequências Positivas

### 1. Personalização em Escala

Cada usuário pode ter um assistente com personalidade única:
- "Amigável e caloroso" para avós
- "Profissional e direto" para trabalho
- "Gamer" para comunidades de games

### 2. Privacidade Preservada

**USER.md** só é injetado em DMs:
- Grupos: não veem informações pessoais
- Canais: não vazam contexto privado
- Sessões secundárias: mantêm isolamento

## Status da Implementação

| Componente | Status |
|-----------|--------|
| Tabela `agent_memory_profiles` | ✅ Criada |
| Campos na `users` | ✅ Criados |
| Context Builder Service | ✅ Implementado |
| Agent Orchestrator Integration | ✅ Integrado |
| Dashboard UI | ✅ Implementado |
| Profile Reset Endpoint | ⏳ Pendente |

## Referências

- OpenClaw Agent Profiles: https://deepwiki.com/openclaw/openclaw/docs/agent-profiles
- ADR-011: Controle Runtime Determinístico
- ADR-016: Session Key Architecture
