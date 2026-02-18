# Observabilidade - Nexo AI

## Visão Geral

O Nexo AI utiliza uma arquitetura híbrida de observabilidade para fornecer visibilidade completa dos fluxos cognitivos de IA:

- **OpenTelemetry** - Tracing distribuído padrão aberto (`@nexo/otel`)
- **Jaeger** - Visualização de traces técnicos (local)
- **Langfuse** - Observabilidade específica para IA/LLMs (Cloud)
- **Sentry** - Monitoramento de erros com contexto rico

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
└─ Sentry (erros)
   ├─ Exception + stacktrace
   ├─ Breadcrumbs (passos anteriores)
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

## Sentry - Error Tracking

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

### Erros com Contexto

Sentry captura automaticamente:
- Stack traces completos
- User context (id, conversation_id)
- Breadcrumbs (log de ações anteriores)
- Link para trace OTEL relacionado

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

## Troubleshooting

### Jaeger não mostra traces

1. Verifique se Jaeger está rodando: `docker-compose ps`
2. Verifique se `OTEL_EXPORTER_OTLP_ENDPOINT` está configurado
3. Verifique os logs da API: `[OTEL] Initialized`

### Langfuse não mostra traces

1. Verifique se as chaves estão corretas
2. Verifique se o ambiente está configurado
3. Aguarde alguns segundos (flush assíncrono)

### Sentry não captura erros

1. Verifique se `SENTRY_DSN` está configurado
2. Verifique se há erros sendo lançados
3. Verifique dashboard do Sentry

## Próximos Passos

- [ ] Configurar alertas no Sentry
- [ ] Criar dashboard customizado no Langfuse
- [ ] Configurar sampling rate baseado em ambiente
- [ ] Adicionar métricas customizadas (latência P99, etc)
