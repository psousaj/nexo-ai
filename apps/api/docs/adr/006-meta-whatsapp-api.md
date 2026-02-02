# ADR-006: Meta WhatsApp Business API Oficial

**Status**: accepted

**Data**: 2026-01-05

## Contexto

Opções para integrar WhatsApp:

1. **Meta API oficial** (WhatsApp Business API)
2. **Evolution API** (self-hosted, não oficial)
3. **Baileys** (library não oficial)
4. **Twilio** (wrapper paid da Meta API)

Requisitos:

- Confiabilidade
- Webhooks estáveis
- Não ser banido
- Custo controlado

## Decisão

Usar **Meta WhatsApp Business API** (oficial).

## Consequências

### Positivas

- **Oficial**: sem risco de ban, SLA garantido
- **Webhooks confiáveis**: delivery garantido, retry automático
- **Features completas**: buttons, lists, media, reactions
- **Suporte**: documentação oficial, support tickets
- **Custo previsível**: free tier 1000 conversas/mês

### Negativas

- **Setup complexo**: Facebook App, Business Account, verificação
- **Webhook required**: não funciona sem servidor público
- **Limites**: rate limits, template approval
- **Custo escala**: ~$0.005-0.009 por mensagem depois free tier

## Implementação

```typescript
// Webhook validation
const signature = req.headers["x-hub-signature-256"];
const hash = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(body)
  .digest("hex");
if (signature !== `sha256=${hash}`) throw new Error("Invalid signature");

// Send message
await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to: userPhone,
    text: { body: message },
  }),
});
```

## Alternativas Consideradas

1. **Evolution API**: Não oficial, risco de ban, mas grátis e fácil
2. **Baileys**: Low-level, muito trabalho, instável
3. **Twilio**: Confiável mas caro ($0.005/msg sem free tier)
4. **MessageBird/Vonage**: Similar ao Twilio

## Decisão Final

Meta API para produção. Evolution API pode ser usado em desenvolvimento.
