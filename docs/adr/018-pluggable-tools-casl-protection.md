# ADR-019: Pluggable Tools System with CASL Protection

**Status**: accepted

**Data**: 2026-02-17

## Contexto

O sistema atual possui **tools hardcoded** que são apresentadas a todos os usuários da mesma forma:

```
Recebi sua mensagem. O que deseja fazer?

1. 💡 Salvar como nota
2. 🎬 Salvar como filme
3. 📺 Salvar como série
4. 🔗 Salvar como link
5. ❌ Cancelar
```

### Problemas

1. **Não escalável**: Adicionar nova tool requer mudança em código
2. **Sem controle global**: Não há como desabilitar uma feature para todos
3. **Sem proteção admin**: Funcionalidades admin não estão protegidas com CASL
4. **Mensagem estática**: Não reflete as tools disponíveis

### Exemplo de Caso de Uso

- **Admin desabilita "save_movie"** → NENHUM usuário pode salvar filmes
- **Admin habilita "save_video"** → TODOS os usuários podem salvar vídeos
- **Feature flag global**: Liga/desliga features sem deploy

## Decisão

Implementar **sistema plugável de tools com controle global** com:

1. **Classificação de tools** em 2 categorias:
   - **Tools de Sistema**: Sempre disponíveis (search_items, enrich_*)
   - **Tools de Usuário**: Habilitáveis/desabilitáveis globalmente (save_*)

2. **Tabela no banco** `global_tools` para controlar tools globalmente

3. **CASL para proteção**: Todas as funcionalidades admin-only **DEVEM** ser protegidas com CASL

4. **Mensagens dinâmicas**: Geradas baseadas nas tools globalmente habilitadas

### Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                   Tool Registry                          │
│  (tools/registry.ts)                                     │
│                                                           │
│  System Tools: [search_items, enrich_movie, ...]        │
│  User Tools:   [save_note, save_movie, save_tv_show]   │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
    ┌──────────────┐              ┌──────────────┐
    │ Global Tools │              │ CASL Rules   │
    │ (database)   │              │ (runtime)    │
    │              │              │              │
    │ global_tools │              │ defineAbility│
    │ table        │              │              │
    └──────────────┘              └──────────────┘
           │                               │
           └───────────────┬───────────────┘
                           ▼
                 ┌──────────────────┐
                 │ Agent Orchestrator│
                 │                   │
                 │ - getEnabledTools()│
                 │ - canUseTool()    │
                 │ - buildMessage()  │
                 └──────────────────┘
```

### Database Schema

```typescript
// global_tools table (SEM userId - feature flags globais)
export const globalTools = pgTable('global_tools', {
  id: uuid('id').defaultRandom().primaryKey(),
  toolName: text('tool_name').notNull().unique(), // 'save_note', 'save_movie', etc
  enabled: boolean('enabled').default(true).notNull(),
  category: text('category').notNull(), // 'system' | 'user'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Tool Registry

```typescript
// apps/api/src/services/tools/registry.ts
export interface ToolDefinition {
  name: ToolName;
  category: 'system' | 'user';
  label: string;
  icon: string;
  description: string;
  requiresAuth: boolean;
  adminOnly: boolean;
}

export const TOOL_REGISTRY: Record<ToolName, ToolDefinition> = {
  // System Tools (sempre disponíveis)
  search_items: {
    name: 'search_items',
    category: 'system',
    label: 'Buscar itens',
    icon: '🔍',
    description: 'Busca nos itens salvos',
    requiresAuth: true,
    adminOnly: false,
  },
  enrich_movie: {
    name: 'enrich_movie',
    category: 'system',
    label: 'Enriquecer filme',
    icon: '✨',
    description: 'Busca metadados TMDB para filme',
    requiresAuth: false,
    adminOnly: false,
  },
  
  // User Tools (habilitáveis/desabilitáveis)
  save_note: {
    name: 'save_note',
    category: 'user',
    label: 'Salvar como nota',
    icon: '💡',
    description: 'Salva texto como nota',
    requiresAuth: true,
    adminOnly: false,
  },
  save_movie: {
    name: 'save_movie',
    category: 'user',
    label: 'Salvar como filme',
    icon: '🎬',
    description: 'Salva filme com busca TMDB',
    requiresAuth: true,
    adminOnly: false,
  },
  save_tv_show: {
    name: 'save_tv_show',
    category: 'user',
    label: 'Salvar como série',
    icon: '📺',
    description: 'Salva série com busca TMDB',
    requiresAuth: true,
    adminOnly: false,
  },
  save_video: {
    name: 'save_video',
    category: 'user',
    label: 'Salvar como vídeo',
    icon: '🎥',
    description: 'Salva vídeo (YouTube, etc)',
    requiresAuth: true,
    adminOnly: false,
  },
  save_link: {
    name: 'save_link',
    category: 'user',
    label: 'Salvar como link',
    icon: '🔗',
    description: 'Salva URL com preview',
    requiresAuth: true,
    adminOnly: false,
  },
};
```

### Tool Service

```typescript
// apps/api/src/services/tools/tool.service.ts
export class ToolService {
  /**
   * Retorna tools globalmente habilitadas
   */
  async getEnabledTools(): Promise<ToolDefinition[]> {
    // 1. Buscar tools no banco
    const globalToolsDb = await db.select().from(globalTools);
    
    // 2. Se vazio, inicializar com defaults
    if (globalToolsDb.length === 0) {
      await this.initializeTools();
      return this.getEnabledTools(); // Recursivo
    }
    
    // 3. Filtrar tools habilitadas
    const enabledTools = globalToolsDb
      .filter(t => t.enabled)
      .map(t => TOOL_REGISTRY[t.toolName])
      .filter(Boolean);
    
    // 4. System tools sempre disponíveis
    const systemTools = Object.values(TOOL_REGISTRY)
      .filter(t => t.category === 'system');
    
    return [...systemTools, ...enabledTools];
  }
  
  /**
   * Verifica se tool está globalmente habilitada
   */
  async canUseTool(toolName: ToolName): Promise<boolean> {
    const tools = await this.getEnabledTools();
    return tools.some(t => t.name === toolName);
  }
  
  /**
   * Atualiza tool global (admin only)
   */
  async updateTool(toolName: ToolName, enabled: boolean): Promise<void> {
    // Protegido por CASL no endpoint
    await db.update(globalTools)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(globalTools.toolName, toolName));
  }
}
```

### Orchestrator Integration

```typescript
// apps/api/src/services/agent-orchestrator.ts

async handleAwaitingContext(conversation, message) {
  // 1. Buscar tools globalmente habilitadas
  const enabledTools = await toolService.getEnabledTools();
  
  // 2. Filtrar apenas tools de save (user category)
  const saveTools = enabledTools.filter(t => 
    t.category === 'user' && t.name.startsWith('save_')
  );
  
  // 3. Construir mensagem dinâmica
  const options = saveTools.map((t, i) => 
    `${i + 1}. ${t.icon} ${t.label}`
  );
  options.push(`${options.length + 1}. ❌ Cancelar`);
  
  const message = `Recebi sua mensagem. O que deseja fazer?\n\n${options.join('\n')}`;
  
  return message;
}
```

### CASL Protection (MANDATORY)

**REGRA**: Toda funcionalidade **admin-only** DEVE ser protegida com CASL

```typescript
// Backend: apps/api/src/routes/dashboard/tools.routes.ts
app.patch('/api/admin/tools/:toolName', 
  authMiddleware,
  caslMiddleware(['manage', 'AdminPanel']), // ← OBRIGATÓRIO
  async (c) => {
    const { toolName } = c.req.param();
    const { enabled } = await c.req.json();
    
    await toolService.updateTool(toolName, enabled);
    
    return c.json({ success: true });
  }
);

// Frontend: apps/dashboard/app/pages/admin/tools.vue
<script setup lang="ts">
import { useAbility } from '@casl/vue';

const { can } = useAbility();

definePageMeta({
  middleware: ['auth', 'role'], // ← OBRIGATÓRIO
});

// No template
onMounted(() => {
  if (!can('manage', 'AdminPanel')) {
    // ← OBRIGATÓRIO
    navigateTo('/');
  }
});
</script>
```

## Consequências

### Positivas

✅ **Escalável**: Adicionar tool = adicionar entrada no registry
✅ **Controle global**: Feature flags para habilitar/desabilitar funcionalidades
✅ **Proteção admin**: CASL obrigatório para admin-only
✅ **Mensagens dinâmicas**: Reflete estado real das tools globais
✅ **Simples**: Sem complexidade de controle por usuário

### Negativas

⚠️ **Migração necessária**: Inicializar tools no banco na primeira vez
⚠️ **Query extra**: A cada ação, buscar tools globais (cacheable com Redis)

## Implementação

### Checklist

- [ ] Criar tabela `global_tools`
- [ ] Criar `tool.service.ts` (global)
- [ ] Modificar `registry.ts` (manter como está)
- [ ] Inicializar tools na primeira vez
- [ ] Endpoint `/api/admin/tools` (GET/PATCH)
- [ ] Modificar `agent-orchestrator.ts` para usar tools dinâmicas
- [ ] Página admin `/admin/tools`
- [ ] Adicionar CASL protection
- [ ] Documentar no AGENTS.md

## Referências

- [CASL Documentation](https://casl.js.org/)
- [ADR-011: Deterministic Runtime Control](./011-deterministic-runtime-control.md)
- [ADR-004: State Machine](./004-state-machine.md)

## Notas de Implementação

### CASL Subjects para Tools

```typescript
// apps/dashboard/app/plugins/casl.ts
export type Subjects = 
  | 'AdminPanel'      // Admin geral
  | 'ToolManagement'  // Gerenciar tools ← NOVO
  | 'Analytics'
  | 'UserContent'
  | 'PersonalData'
  | 'all';
```

### Default Tools Globais

Quando sistema inicializa pela primeira vez:
- **Todas as tools habilitadas por padrão**
- Admin pode desabilitar conforme necessário

### Cache Strategy

```typescript
// Cache tools globais por 5 min
const cacheKey = 'global_tools:enabled';
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const tools = await toolService.getEnabledTools();
await redis.setex(cacheKey, 300, JSON.stringify(tools));
return tools;
```

## Status

✅ **Aceito** - Implementação corrigida em 2026-02-17 (controle global, não por usuário)
