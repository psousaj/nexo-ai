# Plan: Implement True Multi-Provider AI Service in Nexo AI (Updated Scope)

## Goal
Refactor the Nexo AI AI service to support multiple LLM providers (Cloudflare AI Gateway, OpenAI, Deepseek, OpenCode) with fallback mechanisms and add a dynamic model/provider selection UI in the admin dashboard.

## Updated Scope
Based on user feedback, reducing scope to:
- **Cloudflare AI Gateway** (already implemented)
- **OpenAI** (official SDK)
- **Deepseek** (OpenAI-compatible API)
- **OpenCode** (for local/open-source model serving)

Removed providers: Anthropic, Groq, OpenRouter, NVIDIA (for now)

## New Requirements
- Add admin dashboard screen for provider/model configuration
- Per-conversation and per-embedding provider/model selection
- Searchable model registry with create-if-not-exists functionality
- Dynamic provider switching at runtime

## Current Context
- The AI service (`apps/api/src/services/ai/index.ts`) currently uses only the Cloudflare AI Gateway provider.
- There is a basic `AIProvider` interface in `apps/api/src/services/ai/types.ts`.
- A `CloudflareAIGatewayProvider` class already exists.
- Environment variables for Cloudflare AI Gateway are defined in `.env.example` and likely in `apps/api/src/config/env.ts`.
- Tests for AI fallback exist (`apps/api/src/tests/ai-fallback.test.ts`) showing the concept.

## Proposed Approach

### 1. Provider Implementation
1. **Define Provider Types**: Extend `AIProviderType` union in `types.ts` to include: `CLOUDFLARE`, `OPENAI`, `DEEPSEEK`, `OPENCODE`
2. **Create Provider Classes**:
   - `OpenAIProvider` (using official OpenAI SDK)
   - `DeepseekProvider` (using OpenAI SDK with Deepseek's base URL)
   - `OpenCodeProvider` (using OpenAI SDK with local endpoint, or custom implementation)
   - Keep `CloudflareAIGatewayProvider` as is
3. **Refactor AIService**:
   - Change `AIService` to accept a list of providers and a strategy (fallback)
   - Implement a `callLLM` method that iterates over providers until one succeeds
   - Add methods to set/get active provider at runtime
   - Add method to get available models per provider
4. **Provider Factory**: Create factory that creates provider instances based on configuration
5. **Model Registry**:
   - Create `ModelRegistry` service to manage available models per provider
   - Support dynamic model discovery and user-added models
   - Searchable select with create option UI

### 2. Configuration Updates
- Add new environment variables:
  - `OPENAI_API_KEY`
  - `DEEPSEEK_API_KEY` 
  - `OPENCODE_BASE_URL` (for local endpoint)
  - `OPENCODE_API_KEY` (if needed for auth)
- Update `apps/api/src/config/env.ts` to load these variables
- Update `.env.example` with the new variables

### 3. Admin Dashboard UI
- Create new admin settings page for AI provider/model configuration
- UI components:
  - Provider selection toggle (enable/disable per provider)
  - Per-provider model management (searchable select + create)
  - Default provider/model selection for:
    - Chat conversations
    - Embedding generation
    - Other AI features
- Store configuration in database or config file
- Provide API endpoints to:
  - Get available providers
  - Get models for a provider
  - Add/remove custom models
  - Set active provider/model per context

### 4. Integration
- Update AI service to read active provider/model from context/request
- Fallback mechanism: if primary provider fails, try secondary enabled providers
- Embedding service should also support multi-provider selection

## Files Likely to Change
- `apps/api/src/services/ai/types.ts` - Add new provider types
- `apps/api/src/services/ai/index.ts` - Refactor AIService for multi-provider
- New provider files:
  - `apps/api/src/services/ai/openai-provider.ts`
  - `apps/api/src/services/ai/deepseek-provider.ts`
  - `apps/api/src/services/ai/opencode-provider.ts`
- `apps/api/src/services/ai/model-registry.ts` - New model registry service
- `apps/api/src/config/env.ts` - Add new environment variable loaders
- `.env.example` - Add new environment variable examples
- Admin UI files (to be created):
  - `apps/web/src/components/admin/ai-provider-settings.tsx` (or similar)
  - API routes for model/provider management
- `apps/api/src/services/ai/__tests__/` - Tests for new providers and fallback

## Implementation Steps (Ordered)
1. Update `types.ts` to add new provider types
2. Create provider classes (OpenAI, Deepseek, OpenCode)
3. Create ModelRegistry service
4. Refactor AIService to support multiple providers and runtime switching
5. Update environment configuration
6. Create admin dashboard UI components
7. Create API endpoints for model/provider management
8. Write unit and integration tests
9. Update documentation and `.env.example`
10. Perform manual verification

## Risks and Mitigations
- **UI Complexity**: Mitigation - Start with simple toggle and model list, iterate
- **Provider Differences**: Mitigation - Use OpenAI-compatible adapters where possible
- **Configuration Persistence**: Mitigation - Use database or dedicated config service
- **Fallback Logic**: Mitigation - Implement circuit breaker pattern to avoid cascading failures