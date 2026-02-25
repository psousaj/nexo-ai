# ADR-020: Workaround para erro 405 do Baileys (Platform.WEB rejeitado)

**Status**: Ativo (workaround temporário)  
**Data**: 2026-02-24  
**Afeta**: `apps/api/src/services/baileys-service.ts`

---

## Contexto

Em **24/02/2026**, o WhatsApp alterou o servidor para rejeitar conexões que se identificam como `Platform.WEB` (valor `14`) no handshake do protocolo Noise Multi-Device (MD). A partir dessa data, **qualquer tentativa de pareamento ou geração de QR Code** resulta em `statusCode: 405 Connection Failure` imediatamente após o `"connected to WA"`, antes mesmo de gerar o QR.

Versões afetadas: `@whiskeysockets/baileys@6.7.x`, `7.0.0-rc.5`, `7.0.0-rc.9` — ou seja, **todas as versões**.

Referências:
- Issue: https://github.com/WhiskeySockets/Baileys/issues/2370
- PR com fix definitivo: https://github.com/WhiskeySockets/Baileys/pull/2365

---

## Causa Raiz

O Baileys envia um payload de registro com `UserAgent.Platform = WEB (14)`. O servidor WA passou a exigir `MACOS (24)`. O handshake WebSocket até completa (`"msg": "connected to WA"`), mas ao receber o payload de registro, o servidor responde com:

```xml
<failure reason="405" location="xxx"/>
```

E fecha a conexão. **Não é problema de credencial, sessão ou IP** — é rejeição de protocolo.

---

## Solução Aplicada (Workaround)

Forçar a versão `[2, 3000, 1033893291]` no `makeWASocket`. Essa versão específica faz o servidor aceitar o client payload sem exigir `Platform.MACOS`.

```typescript
// apps/api/src/services/baileys-service.ts
const socket = makeWASocket({
  auth: state,
  version: [2, 3000, 1033893291], // ← workaround para 405
  // ...
});
```

---

## ⚠️ Ação Pendente — Checar ao atualizar o Baileys

Antes de atualizar `@whiskeysockets/baileys` para qualquer nova versão:

1. **Verificar se o PR #2365 foi mergeado**: https://github.com/WhiskeySockets/Baileys/pull/2365  
   - Se **sim**: o fix `Platform.WEB → MACOS` já está na lib. Remover a linha `version: [2, 3000, 1033893291]` do `makeWASocket` em `baileys-service.ts` e testar.  
   - Se **não**: manter o workaround e verificar se a nova versão ainda aceita o `version` fixo.

2. **Testar após remover o workaround**:
   - Limpar `./baileys-auth` completamente
   - Subir o servidor e verificar se o QR Code é gerado
   - Se `statusCode: 405` voltar → o fix ainda não chegou, recolocar o `version` fixo

3. **Alternativa ao `version` fixo** (caso pare de funcionar): aplicar o patch manualmente na lib:
   ```
   # Em node_modules/@whiskeysockets/baileys/lib/Utils/validate-connection.js
   # Trocar: platform: proto.ClientPayload.UserAgent.Platform.WEB
   # Por:    platform: proto.ClientPayload.UserAgent.Platform.MACOS
   ```
   Mas isso exige `patch-package` para ser persistido.

---

## Decisão

Manter o workaround `version: [2, 3000, 1033893291]` até que o PR #2365 seja mergeado e uma nova versão do Baileys seja publicada. É a solução menos invasiva e confirmada por múltiplos usuários.
