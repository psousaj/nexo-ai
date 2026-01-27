# Better Auth Hooks - Workaround Temporário

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

## ✅ Solução Aplicada

### 1. Hooks Desabilitados Temporariamente

Os hooks customizados em [src/lib/auth.ts](../src/lib/auth.ts) foram **comentados**:

```typescript
// HOOKS DESABILITADOS TEMPORARIAMENTE - Better Auth 1.4.17 tem bug com Hono
// Ver: https://github.com/better-auth/better-auth/issues/xxx
// TODO: Reativar quando Better Auth 1.5.x for lançado ou usar plugin específico
```

### 2. Funcionalidades Afetadas

Com os hooks desabilitados, **não funciona mais automaticamente**:

- ❌ **Linking OAuth com usuário existente**: OAuth sempre cria novo usuário
- ❌ **Sincronização automática**: `user_accounts` e `user_emails` não sincronizam via OAuth
- ✅ **Autenticação básica**: Email/senha continua funcionando
- ✅ **OAuth básico**: Login com Discord/Google funciona (mas cria novo usuário)

## 🔧 Alternativas

### Opção 1: Sincronização Manual (Recomendado para MVP)

Criar endpoint específico para vincular contas OAuth:

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
