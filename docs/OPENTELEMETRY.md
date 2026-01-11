# OpenTelemetry + Uptrace Integration

## Visão Geral

Nexo AI usa OpenTelemetry para observabilidade distribuída, enviando traces para o Uptrace.

## Setup

### 1. Variável de Ambiente

```bash
# .env
UPTRACE_DSN="https://your-project-key@uptrace.dev/your-project-id"
```

### 2. Como funciona

O middleware OpenTelemetry é **condicional**:

- ✅ Se `UPTRACE_DSN` estiver definido → telemetria ativa
- ❌ Se não estiver definido → telemetria desabilitada (sem overhead)

### 3. Configuração

```typescript
// src/app.ts
import { opentelemetry } from '@elysiajs/opentelemetry';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

const traceExporter = env.UPTRACE_DSN
	? new OTLPTraceExporter({
			url: 'https://otlp.uptrace.dev/v1/traces',
			headers: {
				'uptrace-dsn': env.UPTRACE_DSN,
			},
	  })
	: undefined;

app.use(
	traceExporter
		? opentelemetry({
				serviceName: 'nexo-ai',
				spanProcessors: [new BatchSpanProcessor(traceExporter)],
		  })
		: (app) => app
);
```

## Traces Capturados

### HTTP Requests

Automaticamente captura:

- Request method, path, headers
- Response status, latency
- Query parameters
- Body size

### Database Operations

Com Drizzle ORM instrumentado:

- SQL queries
- Connection pool stats
- Transaction duration

### External APIs

Com instrumentação manual:

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('nexo-ai');

async function enrichMovie(title: string) {
	const span = tracer.startSpan('tmdb.search');
	span.setAttribute('movie.title', title);

	try {
		const result = await tmdbAPI.search(title);
		span.setStatus({ code: SpanStatusCode.OK });
		return result;
	} catch (error) {
		span.recordException(error);
		span.setStatus({ code: SpanStatusCode.ERROR });
		throw error;
	} finally {
		span.end();
	}
}
```

## Uptrace Dashboard

### Visualização

- **Latency distribution**: P50, P95, P99
- **Error rate**: 4xx/5xx por endpoint
- **Throughput**: Requests/segundo
- **Service map**: Dependências entre services

### Alertas

Configure alertas no Uptrace para:

- Latência > 1s
- Error rate > 1%
- Taxa de fallback AI > 10%

### Queries Úteis

```sql
-- Top 10 endpoints mais lentos
SELECT
  http.route,
  percentile(duration, 0.95) as p95
FROM spans
WHERE service.name = 'nexo-ai'
GROUP BY http.route
ORDER BY p95 DESC
LIMIT 10;

-- Taxa de erro por hora
SELECT
  time_bucket('1 hour', timestamp) as hour,
  count(*) FILTER (WHERE http.status_code >= 500) as errors,
  count(*) as total
FROM spans
WHERE service.name = 'nexo-ai'
GROUP BY hour
ORDER BY hour DESC;
```

## Deployment

### Cloudflare Workers

OpenTelemetry funciona no Workers, mas com limitações:

- BatchSpanProcessor envia traces assincronamente
- Use `context.waitUntil()` para não perder traces

```typescript
// worker.ts
export default {
	async fetch(request, env, ctx) {
		const response = await app.handle(request);

		// Garante que spans sejam enviados
		ctx.waitUntil(traceExporter.shutdown());

		return response;
	},
};
```

### Docker

Funciona nativamente sem configuração extra.

## Custos

### Uptrace Free Tier

- 1M spans/mês grátis
- Retenção: 7 dias
- Sem limite de usuários

### Estimativa Nexo AI

- 10k mensagens/dia
- ~5 spans por mensagem (HTTP + DB + AI + Enrichment)
- Total: **1.5M spans/mês** → ~$5/mês (Uptrace Pro)

## Alternativas

Se Uptrace não atender:

- **Jaeger** (self-hosted, free)
- **Grafana Tempo** (self-hosted, free)
- **New Relic** (pago, $99+/mês)
- **Datadog** (pago, $15+/mês)

Trocar provider: apenas mudar URL do exporter, código permanece igual.

## Troubleshooting

### Traces não aparecem

1. Verifique `UPTRACE_DSN` está correto
2. Teste endpoint: `curl https://otlp.uptrace.dev/v1/traces`
3. Logs do exporter: `DEBUG=* bun run dev`

### Performance

OpenTelemetry adiciona ~1-2ms de latência por request.

Para desabilitar temporariamente:

```bash
unset UPTRACE_DSN  # ou remova do .env
```

## Referências

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Uptrace Docs](https://uptrace.dev/get/get-started.html)
- [@elysiajs/opentelemetry](https://elysiajs.com/plugins/opentelemetry.html)
