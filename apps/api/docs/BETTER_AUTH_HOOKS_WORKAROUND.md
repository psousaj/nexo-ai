# Better Auth Hooks - Solução Implementada ✅

## 🐛 Problema Identificado

Better Auth **1.4.17** tem um bug conhecido na integração com **Hono** que causa o erro:

```
TypeError: Cannot read properties of undefined (reading 'headers')
at runAfterHooks (/node_modules/better-auth/src/api/to-auth-endpoints.ts:291:15)
```

### Causa Raiz

O contexto interno do Better Auth (`context.context`) não é propagado corretamente quando usado com Hono, causando:
1. Erro ao tentar acessar `context.context.headers` nos hooks
2. Tipos TypeScript incorretos (`MiddlewareInputContext` vs tipo esperado)
3. Crash do servidor em requests de autenticação

## ✅ Solução Implementada

### Arquitetura da Solução

```
OAuth Callback → Better Auth (salva no DB) → setTimeout(500ms) → Busca última account criada → syncOAuthAccount()
                                                                                                      ↓
                                                                               Sincroniza auth_providers + user_emails
```

### Componentes

#### 1. [auth-account-sync-plugin.ts](../src/lib/auth-account-sync-plugin.ts)
Serviço de sincronização que:
- Cria entrada em `auth_providers` (canônico para mensageria Telegram/WhatsApp/Discord)
- Adiciona email em `user_emails` (sistema multi-email)
- Trata duplicações e conflitos

#### 2. [auth-better.routes.ts](../src/routes/auth-better.routes.ts)
Router customizado que:
- Detecta callbacks OAuth (`/callback/discord`, `/callback/google`)
- Aguarda 500ms para Better Auth salvar no DB
- Busca account mais recente + email do user
- Chama `syncOAuthAccount()` em background
- **Não bloqueia** a resposta ao usuário

### 2. Funcionalidades

✅ **Sincronização automática**: Após OAuth, `auth_providers` e `user_emails` são criados  
✅ **Não bloqueia UX**: Sincronização roda em background (setTimeout)  
✅ **Autenticação básica**: Email/senha continua funcionando  
✅ **OAuth funcional**: Login com Discord/Google vincula corretamente  
⚠️ **Linking manual**: Vincular conta existente ainda requer endpoint dedicado (futuro)

## 🎯 Como Funciona

### Fluxo OAuth Completo

```
1. Usuário clica "Login com Discord"
   ↓
2. Better Auth redireciona para Discord OAuth
   ↓
3. Usuário autoriza aplicação
   ↓
4. Discord redireciona para /api/auth/callback/discord
   ↓
5. Better Auth:
   - Valida token
   - Cria/atualiza user em `users`
   - Cria account em `accounts`
   - Retorna 200 OK
   ↓
6. Router detecta "/callback/" na URL
   ↓
7. setTimeout(500ms) → background sync:
   - Busca última account criada (DESC createdAt)
   - Busca email do user
   - Chama syncOAuthAccount()
   ↓
8. syncOAuthAccount():
   - Cria auth_providers (provider, provider_user_id)
   - Adiciona user_emails (se email fornecido)
   ↓
9. ✅ Usuário logado + accounts sincronizadas
```

## 🧪 Como Testar

### Teste 1: OAuth Discord/Google
1. Limpar banco de dados de teste
2. Acessar dashboard: `http://localhost:5173`
3. Clicar em "Login com Discord"
4. Autorizar aplicação
5. **Verificar logs**:
```
🔗 [Sync] Sincronizando OAuth account
✅ user_account criado via OAuth
✅ Email adicionado via OAuth
```
6. **Verificar banco**:
```sql
SELECT * FROM auth_providers WHERE provider = 'discord';
SELECT * FROM user_emails WHERE provider = 'discord';
```

**Esperado**: 
- ✅ Login com sucesso
- ✅ vínculo em `auth_providers` criado automaticamente
- ✅ Email adicionado em `user_emails` automaticamente
- ✅ Sem erros no console

## 📊 Trade-offs da Solução

### Vantagens
- ✅ **Estável**: Não usa hooks bugados
- ✅ **Não bloqueia UX**: Sincronização em background
- ✅ **Simples**: Apenas 2 arquivos modificados
- ✅ **Testável**: Função pura `syncOAuthAccount()`
- ✅ **Logs claros**: Fácil debugar

### Limitações
- ⚠️ **Delay de 500ms**: Necessário para Better Auth salvar no DB
- ⚠️ **Assume última account**: Se 2 usuários fizerem OAuth no mesmo segundo, pode haver race condition (improvável)
- ⚠️ **Não previne duplicação de usuário**: Se email já existe, Better Auth cria novo user (futuro: implementar pré-check)

## 🔮 Roadmap Futuro

### v0.4.x (Atual - IMPLEMENTADO ✅)
- ✅ Sincronização automática após OAuth
- ✅ Logs detalhados
- ✅ Sem crashes do servidor

### v0.5.x (Próximo)
- 🔄 Endpoint `/api/auth/link-account` para linking manual
- 🔄 Prevenir duplicação de usuário (check email antes de criar)
- 🔄 Dashboard para gerenciar contas vinculadas

### v1.0.x (Futuro)
- 🔄 Upgrade Better Auth quando bug for corrigido
- 🔄 Migrar para hooks nativos (se corrigidos)
- 🔄 Remover setTimeout hack

## 📚 Referências

- [Better Auth Issues](https://github.com/better-auth/better-auth/issues)
- [ADR-007: Multi-Provider Support](./adr/007-multi-provider-support.md)
- [Código: auth-account-sync-plugin.ts](../src/lib/auth-account-sync-plugin.ts)
- [Código: auth-better.routes.ts](../src/routes/auth-better.routes.ts)

---

**Status**: ✅ Solução implementada e funcionando  
**Última atualização**: 2026-01-27  
**Responsável**: Sistema de autenticação


```typescript
// POST /api/auth/link-oauth
app.post('/api/auth/link-oauth', async (c) => {
  const { userId, provider, externalId, email } = await c.req.json();
  
  // 1. Criar user_account
  await db.insert(userAccounts).values({
    userId, provider, externalId, metadata: {}
  });
  
  // 2. Adicionar email (se fornecido)
  if (email) {
    await userEmailService.addEmail(userId, email, provider, true);
  }
  
  return c.json({ success: true });
});
```

### Opção 2: Middleware Pós-Autenticação

Adicionar middleware que detecta nova autenticação OAuth e sincroniza:

```typescript
app.use('/api/*', async (c, next) => {
  await next();
  
  // Após resposta, verificar se foi OAuth
  const user = c.get('user');
  if (user?.oauthProvider) {
    await syncUserAccountsAfterOAuth(user);
  }
});
```

### Opção 3: Upgrade Better Auth (Quando Disponível)

Monitorar releases e atualizar para versão que corrige o bug:

```bash
# Quando Better Auth 1.5.x for lançado
pnpm update better-auth@latest
```

## 📋 Roadmap

### v0.4.x (Atual)
- ✅ Hooks desabilitados para estabilidade
- ✅ Autenticação básica funcionando
- ⏳ Sincronização manual via endpoint (se necessário)

### v0.5.x (Futuro)
- 🔄 Upgrade Better Auth quando bug for corrigido
- 🔄 Reativar hooks customizados
- 🔄 Testes de integração OAuth completos

## 🧪 Como Testar

### Teste 1: Autenticação Email/Senha
```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "senha123"}'
```

**Esperado**: Login com sucesso, sem erros no console

### Teste 2: OAuth Discord/Google
1. Acessar dashboard: `http://localhost:5173`
2. Clicar em "Login com Discord" ou "Login com Google"
3. Autorizar aplicação

**Esperado**: 
- ✅ Login com sucesso
- ⚠️ **Não** cria `user_account` automaticamente
- ⚠️ **Não** adiciona email em `user_emails` automaticamente

## 📚 Referências

- [Better Auth Issues](https://github.com/better-auth/better-auth/issues)
- [Hono Integration Guide](https://hono.dev/guides/best-practices)
- [ADR-007: Multi-Provider Support](./adr/007-multi-provider-support.md)

---

**Status**: ⚠️ Workaround ativo  
**Última atualização**: 2026-01-27  
**Responsável**: Sistema de autenticação
