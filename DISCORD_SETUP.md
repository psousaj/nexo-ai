# Como configurar o Discord Bot do Nexo AI

## Passo 1: Criar o Bot no Discord

1. Acesse: https://discord.com/developers/applications
2. Clique em **"New Application"**
3. Dê um nome (ex: "Nexo AI") e clique em **Create**

## Passo 2: Criar o Bot

1. No menu lateral, clique em **"Bot"**
2. Clique em **"Add Bot"** > **"Yes, do it!"**
3. Copie o **Token do Bot** (botão "Reset Token" para revelar)

## Passo 3: Configurar Permissões

**Importante**: O bot precisa das seguintes permissões (bits):

```
268445712 (Permissions decimal)
```

Ou manualmente:
- ✅ Send Messages
- ✅ Embed Links
- ✅ Attach Files
- ✅ Read Message History
- ✅ Add Reactions
- ✅ Use Slash Commands
- ✅ Use External Emojis

## Passo 4: Instalar o Bot no Servidor

### Método 1: URL de Instalação Rápida

Crie uma URL com este formato (substitua `BOT_CLIENT_ID`):

```
https://discord.com/oauth2/authorize?client_id=SEU_CLIENT_ID&permissions=268445712&scope=bot%20applications.commands
```

Ou use este gerador visual: https://discordapi.com/permissions.html#268445712

**Substitua `SEU_CLIENT_ID`** pelo ID da sua aplicação (mostrado no topo da página do Discord Developer Portal).

### Método 2: Link Direto

1. No menu lateral, clique em **"OAuth2"** > **"URL Generator"**
2. Em **Scopes**, selecione:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Em **Bot Permissions**, selecione as permissões listadas acima
4. Copie a **Generated URL** na parte inferior
5. Abra a URL no navegador e selecione o servidor

## Passo 5: Adicionar o Token ao .env

No arquivo `.env` do projeto, adicione:

```bash
# Discord Bot (obter em: https://discord.com/developers/applications)
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKl.AbCdEfGhIjKlMnOpQrStUvWxYz
```

**Substitua** pelo token que você copiou no Passo 2.

## Passo 6: Reiniciar o Servidor

```bash
# Parar o servidor atual (Ctrl+C)
# E iniciar novamente:
pnpm dev:api
```

## Passo 7: Registrar Comandos Slash (Primeira vez)

Os comandos slash (/start, /help, /status, etc.) são registrados automaticamente quando o bot inicia.

Se não aparecerem após 1 minuto, reinicie o bot.

## Passo 8: Testar

1. No Discord, digite `/start` em um servidor onde o bot está
2. Ou mencione o bot: `@NexoAssistente help`

## Troubleshooting

### Bot não responde aos comandos slash
- Verifique se o bot tem a permissão **"Use Slash Commands"**
- Verifique se `DISCORD_BOT_TOKEN` está correto no .env
- Aguarde alguns minutos (comandos podem demorar a aparecer)

### Bot não recebe menções (@Nexo)
- Verifique se `DISCORD_BOT_USERNAME` está configurado no .env
- Deve ser igual ao username do bot (com _bot no final)
- Exemplo: `NexoAssistente_bot`

### Erro "401 Unauthorized"
- O token está incorreto ou expirou
- Gere um novo token no Discord Developer Portal

### Bot não tem permissão para enviar mensagens
- Reinstale o bot no servidor com a URL correta
- Verifique se as permissões incluem "Send Messages"

---

**Seu Client ID atual**: `1465015304244559892` (já está configurado)

**URL de instalação pronta** (substitua CLIENT_ID se necessário):
```
https://discord.com/oauth2/authorize?client_id=1465015304244559892&permissions=268445712&scope=bot%20applications.commands
```
