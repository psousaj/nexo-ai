# Observabilidade - Nexo AI

## Visão Geral

O Nexo AI possui uma arquitetura de observabilidade completa com:

- **OpenTelemetry** - Tracing distribuído padrão aberto (`@nexo/otel`)
- **Jaeger** - Visualização de traces técnicos (local via Docker)
- **Langfuse** - Observabilidade específica para IA/LLMs (Cloud)
- **Sentry** - Error tracking + Logs estruturados + Metrics + Profiling (Cloud)

## Arquitetura de Tracing

```
Mensagem recebida (trace raiz)
├─ OpenTelemetry Spans (técnico)
│  ├─ webhook.receive (HTTP)
│  ├─ queue.add (Bull)
│  ├─ queue.process (Worker)
│  ├─ command.check
│  ├─ offensive_content.check
│  ├─ user.find_or_create
│  ├─ onboarding.check
│  ├─ agent.process_message
│  │  ├─ conversation.get_state
│  │  ├─ intent.classify (neural/llm)
│  │  ├─ ambiguity.check (NLP)
│  │  ├─ action.decide
│  │  ├─ llm.call (Cloudflare AI Gateway)
│  │  ├─ tool.execute
│  │  ├─ conversation.update_state
│  │  ├─ conversation.save_messages
│  │  └─ conversation.schedule_close
│  └─ messaging.send (Telegram/WhatsApp)
│
├─ Langfuse Traces (cognitivo)
│  ├─ Prompt + Context (system + history)
│  ├─ LLM Response (raw + parsed)
│  ├─ Token usage (prompt + completion)
│  ├─ Latência breakdown
│  └─ Decisão (rule vs LLM + tool escolhida)
│
└─ Sentry (erros + logs)
   ├─ Exception + stacktrace
   ├─ Breadcrumbs (passos anteriores)
   ├─ Logs estruturados (info, warn, error)
   ├─ User context (id, conversation_id)
   └─ Link para trace OTEL (trace_id)
```

## Uso

### Logs Estruturados com Sentry

```typescript
import { sentryLogger } from '@/sentry';

// Logs informativos
sentryLogger.info('Processing message', {
	userId: user.id,
	conversationId: conversation.id,
	messageLength: message.length,
});

// Logs de performance
import { capturePerformanceLog } from '@/sentry';
capturePerformanceLog('LLM call completed', duration, {
	model: 'llama-3.3-70b',
	tokens: response.usage.totalTokens,
});

// Logs de aviso
sentryLogger.warn('High latency detected', {
	endpoint: '/webhook/telegram',
	latency: 5000,
});

// Logs de erro
try {
	await riskyOperation();
} catch (error) {
	sentryLogger.error('Operation failed', error, {
		operation: 'save_movie',
		userId: user.id,
	});
	throw error;
}
```

### Spans Manuais com OpenTelemetry

```typescript
import { startSpan, setAttributes, recordException } from '@nexo/otel/tracing';

// Criar span para uma operação
const result = await startSpan('database.query', async (span) => {
	setAttributes({
		'db.name': 'users',
		'db.operation': 'select',
	});

	const data = await db.query('SELECT * FROM users');
	setAttributes({ 'db.row_count': data.length });

	return data;
});

// Registrar exceção
try {
	await operation();
} catch (error) {
	recordException(error as Error, {
		'operation.type': 'critical',
	});
	throw error;
}
```

### Capturar Exceções com Contexto

```typescript
import { captureException, setSentryContext, setSentryUser, getCurrentTraceId } from '@/sentry';

try {
	await processMessage(message);
} catch (error) {
	// Define contexto do usuário
	setSentryUser({ id: user.id, email: user.email });

	// Adiciona contexto adicional
	setSentryContext('message_processing', {
		conversationId: conversation.id,
		messageLength: message.length,
		provider: 'telegram',
	});

	// Captura exceção com trace ID para correlação
	captureException(error as Error, {
		user_id: user.id,
		conversation_id: conversation.id,
		trace_id: getCurrentTraceId(),
		provider: 'telegram',
	});

	throw error;
}
```

## Configuração

### Variáveis de Ambiente

```bash
# OpenTelemetry (Jaeger)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=nexo-ai-api

# Langfuse (AI Observability)
LANGFUSE_PUBLIC_KEY=pk-xxx
LANGFUSE_SECRET_KEY=sk-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Sentry (Error Tracking + Logs)
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=${NODE_ENV}
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Debug

### Testar Sentry

```bash
# 1. Configure o DSN no .env
SENTRY_DSN=https://xxx@sentry.io/xxx

# 2. Inicie a API em desenvolvimento
pnpm --filter @nexo/api dev

# 3. Acesse a rota de debug
curl http://localhost:3001/debug-sentry

# 4. Verifique o erro + log no Dashboard Sentry
```

### Verificar Jaeger

```bash
# Iniciar Jaeger
docker-compose up -d jaeger

# Enviar uma mensagem pelo Telegram/WhatsApp
# Exemplo: "Salve o filme Duna"

# Abrir UI do Jaeger
# http://localhost:16686

# Buscar traces por:
# - Service: @nexo/api
# - Operation: webhook.receive, message.process, llm.call, etc.
```

## Métricas Customizadas

Sentry Metrics permite enviar contadores, gauges e timers customizados:

```typescript
import { sentryMetrics, incrementCounter, recordTiming } from '@/sentry';

// Contador - quantas vezes uma ação aconteceu
sentryMetrics.increment('user_action_save_movie', 1, {
	provider: 'telegram',
	movie_genre: 'sci-fi',
});

// Ou helper simplificado
incrementCounter('llm_calls_total', 1, {
	model: 'llama-3.3-70b',
	success: true,
});

// Gauge - valor absoluto (ex: fila size)
sentryMetrics.set('queue_size', 42, {
	queue_name: 'message-processing',
});

// Timing - duração em segundos
recordTiming('llm_call_duration', 1250, {
	model: 'llama-3.3-70b',
	tokens: 450,
});

// Ou com duração em ms
const durationMs = Date.now() - startTime;
sentryMetrics.timing('database_query', durationMs / 1000, {
	table: 'users',
	operation: 'select',
});

// Distribuição - histograma de valores
sentryMetrics.distribution('response_time_ms', 150, 'millisecond', {
	endpoint: '/webhook/telegram',
});
```

### Exemplos Práticos

```typescript
// Contador de mensagens processadas
async function processMessage(message) {
	incrementCounter('messages.total', 1, { provider: 'telegram' });

	const start = Date.now();
	try {
		await agentOrchestrator.processMessage(message);
		incrementCounter('messages.success', 1, { provider: 'telegram' });
	} catch (error) {
		incrementCounter('messages.error', 1, { provider: 'telegram' });
		throw error;
	} finally {
		recordTiming('message_processing_duration', Date.now() - start, {
			provider: 'telegram',
		});
	}
}

// Contador de tokens LLM
sentryMetrics.increment('llm.tokens_total', response.usage.totalTokens, {
	model: 'llama-3.3-70b',
});

// Gauge de itens no banco de dados
const itemCount = await db.countItems();
sentryMetrics.set('database.item_count', itemCount, {
	userId: user.id,
});
```

## Profiling Automático

Sentry Profiling captura automaticamente performance profiles durante traces ativos:

```typescript
// Profiling é automático quando traces estão ativos
// Configure via environment variables:
SENTRY_TRACES_SAMPLE_RATE=1.0      // 100% dos traces
SENTRY_PROFILE_SESSION_SAMPLE_RATE=1.0  // 100% com profiling

// O profiling acontece automaticamente durante spans
await startSpan('heavy_operation', async () => {
	// Este código será profileado automaticamente
	await complexCalculation();
	await databaseQuery();
	await externalAPICall();
});
```

**Nota**: Profiling é ativado automaticamente para spans quando `profileLifecycle: 'trace'` está configurado.

## Dashboards

### Jaeger (Local)
- URL: http://localhost:16686
- Visualização: Traces distribuídos com timeline completa
- Filtros: Service, Operation, Tags

### Langfuse (Cloud)
- URL: https://cloud.langfuse.com
- Visualização: Traces de LLM, prompts, respostas, tokens
- Métricas: Custo por token, latência, comparação de versões

### Sentry (Cloud)
- URL: https://sentry.io
- **Issues**: Erros com stack traces e contexto
- **Logs**: Logs estruturados enviados via `Sentry.logger`
- **Performance**: Traces com profiling data
- **Metrics**: Métricas customizadas (contadores, gauges, timers)
