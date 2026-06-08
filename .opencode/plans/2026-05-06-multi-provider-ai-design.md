# Multi-Provider AI Service — Design Spec

**Issue:** NEX-53
**Date:** 2026-05-06
**Status:** Design approved

---

## 1. Overview

Refatorar o serviço de AI para suportar múltiplos providers LLM com fallback automático, unificando os dois caminhos de chamada atuais (`AIService` + `OpenAIGatewayTransport`) em um único `MultiProviderService` com `RuntimeRound` como contrato canônico.

**Providers (escopo inicial):**
1. Cloudflare AI Gateway (mantido, refatorado)
2. OpenAI (SDK oficial, direto)
3. DeepSeek (OpenAI SDK com baseURL custom)

OpenCode fica como placeholder para iteração futura.

**Breaking change:** Sem backward compatibility com `AIResponse` legado. `RuntimeRound` é o único formato de saída.

---

## 2. Architecture

### Before (current)
```
AIService → CloudflareAIGatewayProvider → AIResponse (texto simples)
OpenAIGatewayTransport → runOpenAIManualLoop → RuntimeRound (estruturado)
```
Dois caminhos separados, ambos batendo só no Cloudflare.

### After (target)
```
MultiProviderService (singleton)
├── providers: Map<AIProviderType, AIProvider>
│   ├── CloudflareProvider
│   ├── OpenAIProvider
│   └── DeepSeekProvider
├── ModelRegistryService (DB-backed)
├── callLLM(params) → RuntimeRound
├── generateEmbedding(text) → EmbeddingResult
└── Fallback: itera models por priority, pula indisponíveis, continua no erro

runOpenAIManualLoop → adaptado para usar MultiProviderService
OpenAIGatewayTransport → removido/absorvido
```

### Key decisions
- **RuntimeRound as canonical contract** — toda chamada LLM retorna RuntimeRound com blocos estruturados (text, tool_use, tool_result, internal_task, error)
- **No backward compat** — `AIResponse` legado é removido
- **Providers independentes** — sem base class compartilhada; cada provider tem sua implementação completa
- **Fallback por iteração** — modelos ordenados por `priority` + `is_default` no model_registry

---

## 3. Types (`apps/api/src/services/ai/types.ts`)

```typescript
export type AIProviderType = 'cloudflare' | 'openai' | 'deepseek';

export interface AIProvider {
  callLLM(params: CallLLMParams): Promise<RuntimeRound>;
  getName(): string;
  getType(): AIProviderType;
  isAvailable(): Promise<boolean>;
}

export interface CallLLMParams {
  model: string;
  messages: OpenAIMessage[];
  systemPrompt?: string;
  tools?: OpenAIToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
}

export interface ModelRegistryEntry {
  id: number;
  provider: AIProviderType;
  modelId: string;
  displayName: string | null;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  contextTypes: Array<'chat' | 'embedding' | 'intent' | 'stt' | 'ttl'>;
  createdAt: Date;
  updatedAt: Date;
}

export type ModelContextType = 'chat' | 'embedding' | 'intent' | 'stt' | 'ttl';
```

---

## 4. Providers

### 4.1 CloudflareProvider (`cloudflare-provider.ts` — refatorado do existente)

- OpenAI SDK apontado para `https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/compat`
- Captura headers `cf-aig-*` para observabilidade (já existe)
- Mapeia resposta OpenAI → RuntimeRound (usa lógica existente do `openai-gateway-transport.ts`)
- `isAvailable()`: testa conectividade com endpoint `/models`

### 4.2 OpenAIProvider (`openai-provider.ts` — novo)

- OpenAI SDK apontado para `https://api.openai.com/v1` (direto)
- API key via `OPENAI_API_KEY` env var
- Mesmo mapeamento OpenAI → RuntimeRound
- `isAvailable()`: testa conectividade com `models.list()`

### 4.3 DeepSeekProvider (`deepseek-provider.ts` — novo)

- OpenAI SDK com `baseURL: 'https://api.deepseek.com/v1'`
- API key via `DEEPSEEK_API_KEY` env var
- Compatível com OpenAI chat completions protocol
- `isAvailable()`: testa conectividade

---

## 5. Model Registry

### 5.1 DB Schema (`apps/api/src/db/schema/model-registry.ts`)

```typescript
export const modelRegistry = pgTable('model_registry', {
  id: serial('id').primaryKey(),
  provider: varchar('provider', { length: 50 }).notNull(),
  modelId: varchar('model_id', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  enabled: boolean('enabled').notNull().default(true),
  priority: integer('priority').default(0),
  isDefault: boolean('is_default').default(false),
  contextTypes: jsonb('context_types').$type<string[]>().default(['chat']),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 5.2 ModelRegistryService (`model-registry.ts`)

- `searchModels(query?, provider?, contextType?)` — ILIKE search no modelId/displayName
- `getOrCreateModel(provider, modelId, defaults?)` — find-or-create pattern
- `getEnabledModels(provider?, contextType?)` — ordenado por priority DESC, isDefault DESC
- `enableModel(id) / disableModel(id)`
- `addModel(params) / updateModel(id, params) / removeModel(id)`

---

## 6. MultiProviderService (`apps/api/src/services/ai/index.ts` — refatorado)

Substitui completamente o `AIService` atual e absorve o `OpenAIGatewayTransport`.

```typescript
export class MultiProviderService {
  private providers: Map<AIProviderType, AIProvider>;
  private modelRegistry: ModelRegistryService;

  constructor() {
    this.modelRegistry = new ModelRegistryService();
    this.providers = new Map();

    if (env.CLOUDFLARE_API_TOKEN) {
      this.providers.set('cloudflare', new CloudflareProvider(
        env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_GATEWAY_ID, env.CLOUDFLARE_API_TOKEN
      ));
    }
    if (env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider(env.OPENAI_API_KEY));
    }
    if (env.DEEPSEEK_API_KEY) {
      this.providers.set('deepseek', new DeepSeekProvider(env.DEEPSEEK_API_KEY));
    }
  }

  async callLLM(params: CallLLMParams): Promise<RuntimeRound> {
    const models = await this.modelRegistry.getEnabledModels(null, 'chat');

    for (const model of models) {
      const provider = this.providers.get(model.provider as AIProviderType);
      if (!provider) continue;
      if (!(await provider.isAvailable())) continue;

      const span = startSpan(`llm.${model.provider}.${model.modelId}`, async () => {
        try {
          return await provider.callLLM({ ...params, model: model.modelId });
        } catch (error) {
          setAttributes({ 'llm.provider_failed': model.provider, 'llm.model_failed': model.modelId });
          loggers.ai.warn(`Provider ${model.provider}/${model.modelId} failed: ${error}`);
          throw error; // rethrow para fallback loop
        }
      });

      try {
        return await span;
      } catch {
        continue; // próximo provider/modelo
      }
    }

    throw new Error('All AI providers exhausted');
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Mesmo padrão de fallback, mas filtra contextType='embedding'
  }
}

export const llmService = instrumentService('llm', new MultiProviderService());
```

---

## 7. Environment Variables (`packages/env/src/index.ts`)

Novas variáveis adicionadas ao schema Zod:

```typescript
// OpenAI (novo)
OPENAI_API_KEY: z.string().optional(),
OPENAI_ENABLED: z.boolean().default('true'),

// DeepSeek (novo)
DEEPSEEK_API_KEY: z.string().optional(),
DEEPSEEK_ENABLED: z.boolean().default('true'),
```

Variáveis Cloudflare existentes permanecem inalteradas. A flag `PROVIDER_SPLIT` existente será removida (não usada).

Atualizar `.env.example` com documentação das novas variáveis.

---

## 8. Admin UI (`apps/dashboard/app/pages/admin/ai-providers.vue`)

Nova página seguindo padrões existentes do dashboard (Nuxt 3, `@nuxt/ui`, TanStack Query, CASL permissions).

### 8.1 Provider Cards
- Cards lado a lado (Cloudflare, OpenAI, DeepSeek)
- Cada card mostra: nome, ícone, status (connected/error/not-configured), toggle ON/OFF
- Botão "Test Connection" que chama `POST /api/admin/ai/test/:provider`
- Cor do status: verde (connected), amarelo (not configured), vermelho (error)

### 8.2 Model Table
- Filtrável por provider (tabs ou select)
- Colunas: Model ID, Display Name, Context Types (badges), Priority, Enabled (toggle)
- Search input global com ILIKE via API
- Linha "Add model" no final ou botão "Add Model" acima da tabela

### 8.3 Add/Edit Model Dialog
- Select provider (dropdown)
- Input modelId (text, required)
- Input displayName (text, optional)
- Checkboxes contextTypes: chat, embedding, intent, stt, ttl
- Number input priority

### 8.4 Tech stack
- TanStack Vue Query (`useQuery` / `useMutation`) para todas as chamadas API
- Composable `useAiProviders()` centralizando fetch logic
- CASL `can('manage', 'AdminPanel')` para gating
- Segue layout `layouts/default.vue` com sidebar admin amber theme

---

## 9. API Routes (`apps/api/src/routes/dashboard/admin.routes.ts` — expandido)

```
GET    /api/admin/ai/providers              Lista providers com status (connected/disabled/error)
PATCH  /api/admin/ai/providers/:type        Habilita/desabilita provider

GET    /api/admin/ai/models?provider=&context=&q=   Lista modelos (filtros opcionais)
POST   /api/admin/ai/models                  Adiciona modelo
PATCH  /api/admin/ai/models/:id              Atualiza modelo
DELETE /api/admin/ai/models/:id              Remove modelo
POST   /api/admin/ai/models/search           Busca com ILIKE (usado pelo searchable select)

POST   /api/admin/ai/test/:provider          Testa conectividade do provider
```

Todas as rotas protegidas por `authMiddleware` + `adminMiddleware`.

---

## 10. Files Changed/Created

| File | Action | Description |
|---|---|---|
| `apps/api/src/services/ai/types.ts` | Rewrite | Novos tipos multi-provider |
| `apps/api/src/services/ai/index.ts` | Rewrite | MultiProviderService substitui AIService |
| `apps/api/src/services/ai/cloudflare-provider.ts` | Refactor | Renamed from cloudflare-ai-gateway-provider.ts |
| `apps/api/src/services/ai/openai-provider.ts` | New | OpenAI provider |
| `apps/api/src/services/ai/deepseek-provider.ts` | New | DeepSeek provider |
| `apps/api/src/services/ai/model-registry.ts` | New | ModelRegistryService |
| `apps/api/src/services/ai/openai-gateway-transport.ts` | Delete | Absorvido pelo MultiProviderService |
| `apps/api/src/services/ai/runtime-contract.ts` | Keep | Canonical types, unchanged |
| `apps/api/src/services/ai/runtime-context-builder.ts` | Keep | Adaptado para novo service |
| `apps/api/src/services/ai/runtime-observability.ts` | Keep | Unchanged |
| `apps/api/src/services/ai/openai-manual-loop.ts` | Update | Usa MultiProviderService |
| `apps/api/src/services/ai/intent-classification-task.ts` | Update | Usa MultiProviderService |
| `apps/api/src/services/ai/embedding-service.ts` | Refactor | Multi-provider embedding |
| `apps/api/src/services/ai/embedding-task.ts` | Update | Usa novo embedding service |
| `apps/api/src/db/schema/model-registry.ts` | New | Drizzle schema |
| `apps/api/src/routes/dashboard/admin.routes.ts` | Update | Novas routes admin AI |
| `packages/env/src/index.ts` | Update | Novas env vars |
| `.env.example` | Update | Documentação novas vars |
| `apps/dashboard/app/pages/admin/ai-providers.vue` | New | Admin UI page |
| `apps/dashboard/app/composables/useAiProviders.ts` | New | Composable API |

---

## 11. Testing

### Unit tests
- `cloudflare-provider.test.ts` — refatorado do `ai-gateway.test.ts`
- `openai-provider.test.ts` — novo, testa OpenAI SDK mockado
- `deepseek-provider.test.ts` — novo, testa DeepSeek SDK mockado
- `model-registry.test.ts` — novo, testa CRUD e search
- `multi-provider-service.test.ts` — refatorado do `ai-fallback.test.ts` (stub atual)

### Integration tests
- Fallback automático: provider 1 falha → provider 2 sucede
- Provider indisponível é pulado
- Todos providers falham → erro "All providers exhausted"
- Model registry: getOrCreateModel, busca ILIKE

### Existing tests
- `runtime-observability.test.ts` — deve continuar passando
- `runtime-context-builder.test.ts` — adaptar para novo service
- `openai-manual-loop.test.ts` — adaptar para MultiProviderService mockado
- `embedding-service.test.ts` — refatorar para multi-provider

---

## 12. Migration & Rollout

1. Migration Drizzle para criar tabela `model_registry`
2. Seed inicial com modelos padrão (Cloudflare models existentes, gpt-4o, deepseek-chat)
3. Deploy com env vars novas (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`) como optional
4. Se novas env vars não estiverem presentes, só Cloudflare funciona (backward compat implícita)
5. Admin acessa `/admin/ai-providers` para ativar/desativar providers e modelos
