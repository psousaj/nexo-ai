# Solução para Contas OAuth Duplicadas

## Problema

Better Auth 1.4.17 cria **nova conta** toda vez que usuário faz OAuth, mesmo se o email já existe no sistema. Hooks não funcionam com Hono (ver [BETTER_AUTH_HOOKS_WORKAROUND.md](../BETTER_AUTH_HOOKS_WORKAROUND.md)).

### Exemplo Real

```
1. Usuário cria conta com jose@crudbox.tech (userId: WG4AbaWByd1TH5jBEfbIs0HNpsY1NhrL)
2. Faz login via Discord com josepsousa2012@gmail.com
3. Better Auth cria NOVA conta (userId: hGiyxywqNkmBy71EUcenwBejZ8M09xGu)
4. Resultado: 2 contas para mesmo usuário ❌
```

## Solução Implementada

### 1. Auto-Merge de Contas Duplicadas (Backend)

**Implementação automática** que detecta e mescla contas duplicadas em tempo real durante callback OAuth.

**Como funciona:**

```typescript
// auth-better.routes.ts - callback OAuth
1. Better Auth cria novo usuário (userId: ABC123)
2. setTimeout(500ms) aguarda persistência no DB
3. Busca último account criado
4. Busca email do novo usuário
5. 🔍 Verifica se JÁ EXISTE outro usuário com mesmo email (userId: XYZ789)
6. ✅ SE SIM → Move account para usuário existente + deleta duplicado
7. ✅ SE NÃO → Sincroniza normalmente
```

**Logs esperados (caso duplicação):**

```
⚠️ DUPLICAÇÃO DETECTADA! Mesclando contas...
   email: "josepsousa2012@gmail.com"
   newUserId: "hGiyxywqNkmBy71EUcenwBejZ8M09xGu"
   existingUserId: "WG4AbaWByd1TH5jBEfbIs0HNpsY1NhrL"

✅ Account movido para usuário existente
   from: "hGiyxywqNkmBy71EUcenwBejZ8M09xGu"
   to: "WG4AbaWByd1TH5jBEfbIs0HNpsY1NhrL"

✅ Usuário duplicado deletado
   userId: "hGiyxywqNkmBy71EUcenwBejZ8M09xGu"

✅ user_account criado via OAuth
✅ Email adicionado via OAuth
```

**Vantagens:**

- ✅ Zero intervenção do usuário
- ✅ Funciona retroativamente (se já duplicou, mescla na próxima vez)
- ✅ Mantém usuário mais antigo (preserva histórico)
- ✅ Cascade deleta sessões antigas automaticamente

### 2. Pre-check de Email (API) [OPCIONAL]

Endpoint criado em `/api/auth/check-email`:

```typescript
POST /api/auth/check-email
Body: { "email": "josepsousa2012@gmail.com" }

Response:
{
  "exists": true,
  "user": {
    "id": "WG4AbaWByd1TH5jBEfbIs0HNpsY1NhrL",
    "name": "José Filho",
    "email": "jose@pinheirodev.com.br"
  }
}
```

**Uso no Dashboard:**

- Antes de iniciar OAuth, frontend chama endpoint
- Se `exists: true` → mostrar mensagem "Você já tem conta, faça login primeiro"
- Se `exists: false` → prossegue com OAuth normalmente

### 2. Funções Helper

#### `findUserByEmail(email: string)`

Busca usuário existente por email antes do OAuth processar.

```typescript
const existingUser = await findUserByEmail('josepsousa2012@gmail.com');
if (existingUser) {
	// Vincular ao usuário existente
}
```

**Busca em 2 lugares:**

1. `users.email` (email principal do Better Auth)
2. `user_emails.email` (emails secundários)

#### `linkOAuthToExistingUser()`

Vincula OAuth account a usuário existente ao invés de criar novo.

```typescript
await linkOAuthToExistingUser({
	existingUserId: 'WG4AbaWByd1TH5jBEfbIs0HNpsY1NhrL',
	provider: 'discord',
	externalId: '278895921268523008',
	email: 'josepsousa2012@gmail.com',
});
```

**O que faz:**

1. Cria entrada em `accounts` (Better Auth) para o usuário existente
2. Cria entrada em `auth_providers` (nosso runtime canônico)
3. Adiciona email em `user_emails` se não existir

## Integração no Dashboard

### Fluxo Recomendado

```vue
<!-- Login.vue -->
<template>
	<button @click="handleDiscordLogin">Login com Discord</button>
</template>

<script setup>
async function handleDiscordLogin() {
	// 1. Buscar email do usuário via Discord OAuth (sem autenticar)
	const discordEmail = await getDiscordEmailPreview(); // API do Discord

	// 2. Verificar se email já existe
	const check = await fetch('/api/auth/check-email', {
		method: 'POST',
		body: JSON.stringify({ email: discordEmail }),
	}).then((r) => r.json());

	// 3. Se já existe, avisar usuário
	if (check.exists) {
		alert(`Você já tem conta com ${check.user.email}. Faça login primeiro e depois vincule seu Discord nas configurações.`);
		return;
	}

	// 4. Prosseguir com OAuth
	window.location.href = '/api/auth/signin/discord';
}
</script>
```

### Alternativa: Vincular Manualmente

Criar página "Configurações > Contas Vinculadas":

```vue
<template>
	<div>
		<h2>Vincular Contas</h2>
		<button @click="linkDiscord">Vincular Discord</button>
		<button @click="linkGoogle">Vincular Google</button>
	</div>
</template>

<script setup>
async function linkDiscord() {
	// Usuário já está autenticado
	// OAuth apenas adiciona account, não cria usuário novo
	window.location.href = '/api/auth/signin/discord?mode=link';
}
</script>
```

## Limitações

### O que RESOLVE ✅

1. **Detecção automática de duplicados**: Backend detecta email duplicado após OAuth
2. **Merge automático**: Move account para usuário existente e deleta duplicado
3. **Preserva histórico**: Mantém usuário mais antigo (cadastrado primeiro)
4. **Zero friction**: Usuário não percebe, processo transparente

### O que NÃO resolve ❌

1. **Race condition**: Se 2 OAuth simultâneos com mesmo email, pode criar 2 duplicados (improvável)
2. **Sessões ativas**: Sessão do novo usuário é invalidada (cascade delete)
3. **Dados do novo usuário**: Se tinha dados únicos (ex: preferências), são perdidos

### Por quê funciona agora?

1. **Better Auth ainda cria conta nova**: Solução implementada sincroniza DEPOIS, não previne a criação
2. **Requires frontend logic**: Dashboard precisa implementar pre-check
3. **Contas já duplicadas**: Não mescla contas existentes automaticamente

### Por quê funciona agora?

- **Detecção pós-criação**: Aceita que Better Auth cria duplicado, mas detecta e corrige imediatamente
- **setTimeout(500ms)**: Garante que Better Auth terminou de persistir no DB
- **Query por email**: Busca todos usuários com mesmo email (se > 1 = duplicação)
- **Move + Delete**: Transfere ownership do account e limpa duplicado
- **Idempotente**: Se rodar 2x, não quebra (account já está no lugar certo)

### Por quê não dá pra prevenir ANTES?

- **Hooks não funcionam** (bug Better Auth + Hono)
- **Não dá pra interceptar ANTES**: Better Auth processa OAuth callback internamente
- **Única solução real**: Detectar e corrigir DEPOIS (implementado ✅)

## Como Limpar Contas Duplicadas

```sql
-- 1. Listar contas duplicadas por email
SELECT email, COUNT(*)
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- 2. Mover accounts da conta nova para a antiga
UPDATE accounts
SET user_id = 'WG4AbaWByd1TH5jBEfbIs0HNpsY1NhrL' -- usuário antigo
WHERE user_id = 'hGiyxywqNkmBy71EUcenwBejZ8M09xGu'; -- usuário duplicado

-- 3. Deletar usuário duplicado
DELETE FROM users
WHERE id = 'hGiyxywqNkmBy71EUcenwBejZ8M09xGu';
```

## Roadmap

### v0.4.2 (imediato)

- [x] Endpoint `/check-email` implementado
- [x] Funções `findUserByEmail` e `linkOAuthToExistingUser`
- [ ] Dashboard: pre-check antes do OAuth
- [ ] Dashboard: mensagem de aviso se email já existe

### v0.5.0 (próximo sprint)

- [ ] Página "Vincular Contas" no dashboard
- [ ] Botão "Mesclar Contas" (admin)
- [ ] Script de limpeza de duplicados

### v1.0.0 (futuro)

- [ ] Upgrade Better Auth quando corrigirem hooks + Hono
- [ ] Remover workarounds temporários
- [ ] Account linking nativo via hooks

## Referências

- [BETTER_AUTH_HOOKS_WORKAROUND.md](../BETTER_AUTH_HOOKS_WORKAROUND.md) - Context do bug original
- [ADR-007: Multi-provider Support](./adr/007-multi-provider-support.md)
- [Better Auth Issue #XXX](https://github.com/better-auth/better-auth/issues) (quando houver)

---

**Status**: ⚠️ Solução parcial implementada - requer integração no dashboard  
**Última atualização**: 2026-01-27  
**Versão**: 0.4.11
