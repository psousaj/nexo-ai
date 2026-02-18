# Observabilidade - Nexo AI

## Visão Geral

O Nexo AI utiliza uma arquitetura híbrida de observabilidade para fornecer visibilidade completa dos fluxos cognitivos de IA:

- **OpenTelemetry** - Tracing distribuído padrão aberto (`@nexo/otel`)
- **Jaeger** - Visualização de traces técnicos (local)
- **Langfuse** - Observabilidade específica para IA/LLMs (Cloud)
- **Sentry** - Monitoramento de erros + **Logs estruturados** (Cloud)

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
   ├─ **Logs estruturados** (info, warn, error, performance)
   ├─ User context (id, conversation_id)
   └─ Link para trace OTEL (trace_id)
```

## Jaeger - Local Development

### Iniciar Jaeger

```bash
# Iniciar Jaeger em background
docker-compose up -d jaeger

# Ver logs
docker-compose logs -f jaeger

# Parar Jaeger
docker-compose down jaeger
```

### Acessar Jaeger UI

Abra http://localhost:16686 no navegador.

### Buscar Traces

1. Selecione o serviço: `@nexo/api`
2. Busque por operações: `webhook`, `process`, `llm`, etc.
3. Clique em um trace para ver a timeline completa de spans

### Configurar OTEL_ENDPOINT

No arquivo `.env`:

```bash
# Para desenvolvimento com Jaeger local
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# Para produção (configurar endpoint OTLP do seu backend)
# OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector:4317
```

## Langfuse - AI Observability

### Configurar

No arquivo `.env`:

```bash
LANGFUSE_PUBLIC_KEY=pk-xxx
LANGFUSE_SECRET_KEY=sk-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Criar Conta Langfuse

1. Acesse https://cloud.langfuse.com
2. Crie uma conta (free tier disponível)
3. Crie um novo projeto
4. Copie as chaves pública e secreta

### Visualizar Traces de IA

No Langfuse Dashboard, você verá:
- **Traces**: Cada chamada LLM com prompts e respostas
- **Token Usage**: Custos e contagem de tokens
- **Scores**: Métricas de qualidade (se configurado)
- **Sessions**: Conversas agrupadas

### Correlação com OTEL

Langfuse usa o mesmo `trace_id` do OpenTelemetry. Links entre traces são automáticos.

## Sentry - Error Tracking + Logs

### Configurar

No arquivo `.env`:

```bash
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=${NODE_ENV}
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Criar Conta Sentry

1. Acesse https://sentry.io
2. Crie uma conta (free tier disponível)
3. Crie um novo projeto para "Node.js"
4. Copie o DSN

### Funcionalidades do Sentry

#### 1. Error Tracking

Sentry captura automaticamente:
- Stack traces completos
- User context (id, conversation_id)
- Breadcrumbs (log de ações anteriores)
- Link para trace OTEL relacionado

#### 2. Logs Estruturados (NOVO)

Envie logs estruturados que aparecem no dashboard do Sentry:

```typescript
import { sentryLogger, capturePerformanceLog } from '@/sentry';

// Log informativo
sentryLogger.info('Processing message', {
	userId: user.id,
	conversationId: conversation.id,
	messageLength: message.length,
});

// Log de performance
capturePerformanceLog('LLM call completed', 1250, {
	model: 'llama-3.3-70b',
	tokens: 450,
});

// Log de aviso
sentryLogger.warn('High latency detected', {
	endpoint: '/webhook/telegram',
	latency: 5000,
});

// Log de erro
try {
	await riskyOperation();
} catch (error) {
	sentryLogger.error('Operation failed', error, {
		operation: 'save_movie',
		userId: user.id,
	});
}
```

#### 3. Integrations

O Sentry já está integrado com:
- **Hono** - Hook `onError` captura exceções HTTP
- **OpenTelemetry** - Links automáticos entre traces e erros
- **Contexto HTTP** - Captura método, URL, path, headers

### Debug - Testar Sentry

```bash
# 1. Configure o DSN no .env
SENTRY_DSN=https://xxx@sentry.io/xxx

# 2. Inicie a API em desenvolvimento
pnpm --filter @nexo/api dev

# 3. Acesse a rota de debug
curl http://localhost:3001/debug-sentry

# 4. Verifique o erro + log no Dashboard Sentry
```

## Variáveis de Ambiente

### OpenTelemetry

| Variável | Descrição | Default |
|----------|-----------|---------|
| `OTEL_SERVICE_NAME` | Nome do serviço | `@nexo/api` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTLP | (obrigatório) |
| `OTEL_RESOURCE_ATTRIBUTES` | Atributos adicionais | - |

### Langfuse

| Variável | Descrição | Default |
|----------|-----------|---------|
| `LANGFUSE_PUBLIC_KEY` | Chave pública | (obrigatório) |
| `LANGFUSE_SECRET_KEY` | Chave secreta | (obrigatório) |
| `LANGFUSE_HOST` | Host Langfuse | `https://cloud.langfuse.com` |

### Sentry

| Variável | Descrição | Default |
|----------|-----------|---------|
| `SENTRY_DSN` | DSN do projeto | (obrigatório) |
| `SENTRY_ENVIRONMENT` | Ambiente | `${NODE_ENV}` |
| `SENTRY_TRACES_SAMPLE_RATE` | Taxa de sampling | `0.1` |
| `SENTRY_LOGS_SAMPLE_RATE` | Taxa de sampling de logs (prod) | `0.1` |

## Troubleshooting

### Jaeger não mostra traces

1. Verifique se Jaeger está rodando: `docker-compose ps`
2. Verifique se `OTEL_EXPORTER_OTLP_ENDPOINT` está configurado
3. Verifique os logs da API: `[OTEL] Initialized`

### Langfuse não mostra traces

1. Verifique se as chaves estão corretas
2. Verifique se o ambiente está configurado
3. Aguarde alguns segundos (flush assíncrono)

### Sentry não captura erros/logs

1. Verifique se `SENTRY_DSN` está configurado
2. Verifique se há erros sendo lançados
3. Verifique dashboard do Sentry
4. Logs aparecem na aba "Logs" do dashboard

## Próximos Passos

- [ ] Configurar alertas no Sentry
- [ ] Criar dashboard customizado no Langfuse
- [ ] Adicionar métricas customizadas (latência P99, etc)
- [ ] Configurar sampling rates baseado em ambiente

