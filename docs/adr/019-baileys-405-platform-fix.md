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

## Solução Aplicada

Duas camadas de fix aplicadas:

### 1. pnpm patch — `Platform.WEB → MACOS` (fix definitivo local)

Arquivo: `patches/@whiskeysockets__baileys.patch`  
Registrado em: `package.json` raiz → `pnpm.patchedDependencies`

```diff
- platform: proto.ClientPayload.UserAgent.Platform.WEB,
+ platform: proto.ClientPayload.UserAgent.Platform.MACOS,
```

O pnpm aplica esse patch automaticamente a cada `pnpm install`. **Não some com reinstalação.**

### 2. Versão dinâmica via `fetchLatestBaileysVersion()` (fallback)

`baileys-service.ts` usa `fetchLatestBaileysVersion()` com cache de 12h e fallback para `[2, 3000, 1034074495]`, além de suporte ao env `BAILEYS_SOCKET_VERSION` para override manual sem redeploy.

---

## ⚠️ Ação Pendente — Checar ao atualizar o Baileys

Quando atualizar `@whiskeysockets/baileys` para nova versão:

1. **Verificar se o PR #2365 foi mergeado**: https://github.com/WhiskeySockets/Baileys/pull/2365
   - Se **sim**: o fix `Platform.MACOS` já está na lib oficial.
     - Remover `patches/@whiskeysockets__baileys.patch`
     - Remover a entrada `"@whiskeysockets/baileys"` de `pnpm.patchedDependencies` no `package.json` raiz
     - Rodar `pnpm install` para confirmar que não há erros
   - Se **não**: o patch continua necessário, mas precisará ser **recriado** para a nova versão:
     ```bash
     pnpm patch @whiskeysockets/baileys --edit-dir /tmp/baileys-patch
     # editar /tmp/baileys-patch/lib/Utils/validate-connection.js
     pnpm patch-commit '/tmp/baileys-patch'
     ```

2. **Testar após qualquer mudança**:
   - Limpar `./baileys-auth` (ou `/data/baileys-auth` em prod) completamente
   - Subir o servidor e verificar se o QR Code é gerado sem erro 405

---

## Decisão

Usar `pnpm patch` para aplicar `Platform.MACOS` diretamente na lib instalada. É persistente, commitado no repositório e reaplicado automaticamente em todo `pnpm install`. Remover o patch quando o PR #2365 for mergeado e uma nova versão do Baileys for publicada com o fix oficial.
