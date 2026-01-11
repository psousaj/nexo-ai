# Guia de Observabilidade - New Relic + Pino

## Configuração Implementada

### 1. **Pino Logger**

- ✅ Logger estruturado em JSON (produção)
- ✅ Pretty print colorido em desenvolvimento
- ✅ Contextual loggers para diferentes módulos
- ✅ Integração nativa com New Relic

### 2. **New Relic APM**

- ✅ Agent instalado e configurado
- ✅ Distributed tracing habilitado
- ✅ Application logging forwarding
- ✅ Transaction tracing
- ✅ Error collector

## Setup Rápido

### 1. Obter License Key do New Relic

1. Acesse [New Relic](https://newrelic.com) e crie uma conta gratuita
2. Vá em **Account Settings** → **API Keys**
3. Copie sua **License Key** (formato: `eu01xxNRAL-...`)

### 2. Configurar Variáveis de Ambiente

Adicione no seu `.env`:

```bash
# Observability - New Relic (opcional)
NEW_RELIC_LICENSE_KEY=eu01xxNRAL-xxxxxxxxxxxxxxxxxxxxxxxx
NEW_RELIC_APP_NAME=nexo-ai
```

### 3. Deploy no Railway

No Railway, adicione as variáveis:

```bash
NEW_RELIC_LICENSE_KEY=<sua-license-key>
NEW_RELIC_APP_NAME=nexo-ai-production
```

## Uso do Logger

### Logger Principal

```typescript
import { logger } from '@/utils/logger';

// Logs simples
logger.info('Mensagem de info');
logger.warn('Aviso');
logger.error('Erro', { error: err });

// Com contexto
logger.info({ userId: '123', action: 'save' }, 'Item salvo');
```

### Loggers Contextuais

```typescript
import { loggers } from '@/utils/logger';

// Logger específico para webhook
loggers.webhook.info('Mensagem recebida do Telegram');

// Logger específico para AI
loggers.ai.debug({ model: 'gemini', tokens: 150 }, 'Request enviado');

// Disponíveis:
// - loggers.webhook
// - loggers.ai
// - loggers.cloudflare
// - loggers.gemini
// - loggers.db
// - loggers.enrichment
```

## Formato dos Logs

### Desenvolvimento (pino-pretty)

```
[2026-01-10 15:30:45] INFO: Mensagem recebida do Telegram
    context: "webhook"
    userId: "123456"
```

### Produção (JSON)

```json
{
	"level": 30,
	"time": 1736526645000,
	"context": "webhook",
	"userId": "123456",
	"msg": "Mensagem recebida do Telegram"
}
```

## New Relic Dashboard

Após deploy, acesse o New Relic para ver:

1. **APM**: Performance da aplicação, tempo de resposta
2. **Distributed Tracing**: Rastreamento de requests
3. **Logs**: Todos os logs da aplicação
4. **Errors**: Erros capturados automaticamente
5. **Transactions**: Rotas mais lentas/usadas

### Queries Úteis (NRQL)

```sql
-- Logs de erro nas últimas 24h
SELECT * FROM Log
WHERE level = 'error'
SINCE 24 hours ago

-- Tempo médio de resposta por rota
SELECT average(duration)
FROM Transaction
FACET request.uri
SINCE 1 hour ago

-- Erros por contexto
SELECT count(*)
FROM Log
WHERE level = 'error'
FACET context
SINCE 1 day ago
```

## Logs sem New Relic

Se você **não quiser** usar New Relic:

1. Não configure as variáveis `NEW_RELIC_*`
2. Comente a importação em `src/index.ts`:
   ```typescript
   // import 'newrelic'; // ← Comente esta linha
   ```
3. Os logs do Pino continuam funcionando normalmente!

## Custos

- **New Relic Free Tier**: 100 GB de dados ingeridos/mês
- **Estimativa Nexo AI**: ~5-10 GB/mês (dependendo do volume)
- **Custo real**: $0/mês até ultrapassar free tier

## Troubleshooting

### Erro: "License key cannot be found"

**Causa**: NEW_RELIC_LICENSE_KEY não configurada

**Solução**:

```bash
# Adicione no .env
NEW_RELIC_LICENSE_KEY=sua-license-key-aqui
```

### Logs não aparecem no New Relic

**Verificar**:

1. License key correta?
2. `NEW_RELIC_APP_NAME` configurado?
3. Aguarde 1-2 minutos (delay de ingestão)

### Formato JSON feio em dev

**Causa**: Transport pino-pretty não carregou

**Solução**:

```bash
pnpm add -D pino-pretty
```

## Arquivos Relacionados

- [newrelic.cjs](../newrelic.cjs) - Configuração do New Relic
- [src/utils/logger.ts](../src/utils/logger.ts) - Setup do Pino
- [src/config/env.ts](../src/config/env.ts) - Validação de envs
- [Dockerfile](../Dockerfile) - Variáveis de ambiente para container

## Referências

- [New Relic Node.js Agent](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/)
- [Pino Documentation](https://getpino.io/)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
