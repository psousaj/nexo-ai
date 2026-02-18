# Sistema de Fechamento Automático de Conversas

## Visão Geral

Sistema robusto que fecha conversas automaticamente após 3 minutos de inatividade, evitando contextos antigos em novas mensagens.

## Arquitetura

### Estados da Conversa

```typescript
type ConversationState =
  | 'idle'            // Conversa inativa, pronta para comandos
  | 'processing'      // Ação em andamento (evita concorrência)
  | 'awaiting_confirmation' // Aguardando confirmação do usuário
  | 'waiting_close'   // Ação finalizada, timer de 3min agendado
  | 'closed';         // Conversa encerrada
```

**Mudanças da versão anterior:**
- ✅ `idle` substituiu `open` (mais semântico)
- ✅ `processing` unificou `enriching`, `saving`, `batch_processing`
- ✅ Removido `error` (estado transitório, não persiste)

### Fluxo Completo

```
1. Usuário envia mensagem
   ↓
2. Webhook cancela timer (se houver)
   ↓
3. State = 'idle'
   ↓
4. Orchestrator processa ação
   ↓
5. Ação finaliza
   ↓
6. State = 'waiting_close'
   ↓
7. Banco: close_at = now() + 3min
   ↓
8. Bull: enfileira delayed job (3min)
   ↓
9a. Se usuário mandar nova msg → cancela timer (volta pra idle)
9b. Se 3min passar → Worker fecha conversa (state = closed)
```

## Componentes

### 1. Database (Source of Truth)

**Campo `close_at` na tabela `conversations`:**
```sql
close_at TIMESTAMP NULL
```

**Por quê?**
- Banco NUNCA mente
- Redis pode cair, fila pode perder jobs
- close_at garante fechamento mesmo sem fila

### 2. Bull Queue (Aceleração)

**Delayed Jobs:**
```typescript
await closeConversationQueue.add(
  'close-conversation',
  { conversationId },
  {
    delay: 3 * 60 * 1000,  // 3 minutos
    attempts: 3,            // Retry até 3x
    backoff: 'exponential', // 5s, 25s, 125s
    removeOnComplete: true
  }
);
```

**Vantagens:**
- ✅ Latência baixa (fecha exato aos 3min)
- ✅ Retry automático
- ✅ Backoff exponencial

### 3. Worker (Idempotente)

```typescript
closeConversationQueue.process(async (job) => {
  const convo = await db.findById(job.data.conversationId);
  
  // CHECAGEM VITAL - evita fechar erroneamente
  if (convo.state !== 'waiting_close') return;
  if (!convo.close_at || convo.close_at > now()) return;
  
  await db.update({ state: 'closed', close_at: null });
});
```

**Por quê idempotente?**
- Job pode rodar 2x (retry, duplicação)
- Usuário pode ter cancelado (nova msg)
- Checagem garante consistência

### 4. Cron de Backup (Anti-Apocalipse)

**Roda a cada 1 minuto:**
```sql
UPDATE conversations
SET state = 'closed', close_at = NULL
WHERE state = 'waiting_close'
  AND close_at <= NOW();
```

**Salva quando:**
- 🔥 Redis morrer
- 🔥 Bull travar
- 🔥 Worker cair
- 🔥 Deploy no meio do job

👉 **Nada fica aberto pra sempre.**

## Fluxos Críticos

### Ação Finaliza

1. Orchestrator detecta finalização
2. Atualiza banco:
   ```typescript
   state = 'waiting_close'
   close_at = now() + 3min
   ```
3. Enfileira job delayed
4. Retorna pro usuário

### Nova Mensagem Chega

1. Webhook verifica: `state === 'waiting_close'`?
2. Se sim:
   ```typescript
   // Cancela no banco
	state = 'idle'
   
   // Remove job (se existir)
   await job.remove()
   ```
3. Processa mensagem normalmente

### Timer Expira (3min)

1. Worker pega job
2. Busca conversa no banco
3. Valida: `state === 'waiting_close'` + `close_at <= now()`
4. Fecha: `state = 'closed'`

## Redis (Upstash)

### Configuração Necessária

```bash
# Extrai de UPSTASH_REDIS_URL ou usa direto
REDIS_HOST=us1-amazing-cod-12345.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-token-here
REDIS_TLS=true  # Upstash usa TLS
```

### Por quê Upstash funciona?

✅ **Persistência ativada** (storage durável)
✅ **Sobrevive a restart** (não é volátil)
✅ **Bull usa listas, não pub/sub** (retry automático)

⚠️ **Latência maior** (aceitável para 3min)

## Garantias

### O que o sistema GARANTE:

✅ Conversas fecham em até 3min após última msg (ou até 4min no pior caso com cron)
✅ Nova mensagem cancela fechamento
✅ Zero perda de estado (banco é source of truth)
✅ Zero race condition (jobs idempotentes)
✅ Recuperação automática de falhas (cron backup)

### O que o sistema NÃO garante:

❌ Fechamento exato em 3:00.000 min (pode variar +/- segundos)
❌ Exactly-once execution (pode rodar job 2x, mas é idempotente)

## Monitoramento

### Logs Importantes

```
📅 Fechamento agendado para <id> em 3min
🔄 Fechamento cancelado para <id>
🔄 Processando fechamento: <id>
✅ Conversa <id> fechada com sucesso
🔧 <n> conversa(s) fechada(s) pelo backup
```

### Métricas a Monitorar

- Taxa de jobs bem-sucedidos vs falhados
- Latência do fechamento (deve ficar ~180s)
- Conversas em `waiting_close` > 5min (bug!)
- Taxa de cancelamentos (engajamento)

## Debugging

### Conversa não fecha

1. **Verificar estado no banco:**
   ```sql
   SELECT id, state, close_at FROM conversations WHERE id = '...';
   ```

2. **Verificar jobs pendentes:**
   ```typescript
   const delayed = await closeConversationQueue.getDelayed();
   ```

3. **Verificar logs do worker**

### Conversa fecha erroneamente

1. **Usuário mandou msg mas não cancelou?**
   - Verificar webhook
   - Verificar função `cancelConversationClose()`

2. **Job rodou 2x?**
   - Normal se idempotente
   - Verificar checagem de estado no worker

## Próximas Melhorias

- [ ] Dashboard de conversas abertas/fechadas
- [ ] Métricas Prometheus/Grafana
- [ ] Alertas se conversas ficam abertas > 1h
- [ ] A/B testing: 3min vs 5min vs 10min
- [ ] Rate limit de reabertura (spam protection)

## Referências

- [ADR-011: Controle Runtime Determinístico](../docs/adr/011-deterministic-runtime-control.md)
- [Bull Queue Docs](https://github.com/OptimalBits/bull)
- [Upstash Redis](https://upstash.com/)
