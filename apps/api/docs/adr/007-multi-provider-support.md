# ADR-007: Suporte Multi-Provider de Mensageria

**Status**: superseded (parcial)

**Data**: 2026-01-07

> Atualização: a estratégia de identidade desta ADR foi substituída pela ADR-021, que define `auth_providers` como fonte canônica e remove dependência de `user_accounts` no runtime.

## Contexto

Sistema inicialmente desenvolvido para WhatsApp Business API precisa:

1. **Flexibilidade**: Suportar múltiplos provedores de chat (Telegram, Discord, etc)
2. **Independência**: Não depender de um único vendor
3. **Unificação**: Mesmo usuário deve ser reconhecido em diferentes plataformas
4. **Baixo acoplamento**: Services core não devem conhecer detalhes de providers

Telegram escolhido como **provider padrão** por:

- Setup mais simples (BotFather vs Meta Business verification)
- Custo zero ilimitado (vs WhatsApp pago após 1000 msgs/dia)
- API mais amigável (JSON direto vs nested payload)
- Rate limits mais generosos (30 msg/s vs 80 req/s global)

WhatsApp mantido como **feature futura** quando houver demanda.

## Decisão

Implementar **Adapter Pattern** para normalizar diferentes providers:

### 1. Interface Comum

```typescript
interface MessagingProvider {
  parseIncomingMessage(payload: any): IncomingMessage | null;
  verifyWebhook(request: Request): boolean;
  sendMessage(recipient: string, text: string): Promise<void>;
  getProviderName(): ProviderType;
}
```

### 2. Mensagem Normalizada

```typescript
interface IncomingMessage {
  messageId: string;
  externalId: string; // phone, chat_id, user_id
  senderName?: string;
  text: string;
  timestamp: Date;
  provider: "whatsapp" | "telegram" | "discord";
  phoneNumber?: string; // Para detecção cross-provider
}
```

### 3. Separação Users vs Accounts

**Antes:**

```typescript
users {
  id, name, phone, email  // phone = WhatsApp-specific
}
```

**Depois:**

```typescript
users {
  id, name, email  // Entidade de domínio pura
}

user_accounts {
  id, userId, provider, externalId, metadata
  // provider + externalId = unique
}
```

### 4. Webhooks Simultâneos

Cada provider tem rota dedicada:

- `POST /webhook/telegram` (padrão)
- `POST /webhook/whatsapp` (futuro)
- `POST /webhook/discord` (futuro)

## Consequências

### Positivas

- **Flexibilidade**: Adicionar novo provider = criar adapter (1 arquivo)
- **Unificação automática**: Telefone detecta usuário existente em outro provider
- **Baixo acoplamento**: Services (conversation, AI, enrichment) não mudam
- **Testável**: Adapters isolados, fácil mockar
- **Extensível**: Futuro dashboard para linking manual

### Negativas

- **Complexidade inicial**: Mais código que integração direta
- **Overhead metadata**: Campo JSONB em `user_accounts` para dados específicos
- **Queries indiretas**: `items` → `users` → `user_accounts` (1 JOIN extra)

## Implementação

### Estrutura

```
src/
├── adapters/messaging/
│   ├── types.ts              # Interface MessagingProvider
│   ├── whatsapp-adapter.ts   # Meta WhatsApp API
│   ├── telegram-adapter.ts   # Telegram Bot API
│   └── index.ts
├── db/schema/
│   ├── users.ts              # Entidade única (sem phone)
│   └── user-accounts.ts      # Identidades por provider
├── routes/
│   └── webhook.ts            # Rotas /telegram e /whatsapp
└── services/
    └── user-service.ts       # findOrCreateUserByAccount()
```

### Detecção Cross-Provider

```typescript
// 1. Busca account por (provider, externalId)
// 2. Se não existe E phoneNumber fornecido:
//    → Busca account de OUTRO provider com mesmo telefone
//    → Se encontrar: cria novo account linkado ao mesmo userId
// 3. Senão: cria user novo + account
```

### Roadmap Features Futuras

1. **WhatsApp** (v0.2.0): Ativar quando houver demanda
2. **Dashboard** (v0.2.0): Linking manual de contas
3. **Discord** (v0.3.0): Provider sem telefone

## Alternativas Consideradas

### 1. Provider por Namespace

**Rejeita**: `users_whatsapp`, `users_telegram` → duplicação de código

### 2. Campo `provider` em `users`

**Rejeita**: Não permite múltiplas contas por usuário

### 3. EAV (Entity-Attribute-Value)

**Rejeita**: Complexo demais, performance ruim

### 4. API Gateway Unificada

**Rejeita**: Overkill para MVP, adiciona latência

## Compatibilidade

- **Breaking change**: Sim (schema alterado)
- **Migration**: Não necessária (banco limpo)
- **Backward compat**: WhatsApp code preservado em adapter

## Referências

- [ADR-005: AI-Agnostic Architecture](005-ai-agnostic.md) - Padrão similar usado para LLMs
- [ADR-004: State Machine](004-state-machine.md) - Conversação já é provider-agnostic
- [Telegram Bot API Docs](https://core.telegram.org/bots/api)
- [Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
