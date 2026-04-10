# Cutover Provider Split (API + Bots)

Guia operacional para ativar o split de providers com ingestão na API e dispatch de saída no app Bots.

## Objetivo

Separar responsabilidades de runtime:

- API recebe webhooks e executa core determinístico.
- Bots executa gateways/adapters e consome saída canônica da fila `adapter-output`.

## Pré-requisitos

- Redis acessível para API e Bots.
- API e Bots na mesma versão de contrato canônico.
- Variáveis de ambiente de providers configuradas em ambos os serviços.
- Feature flag `PROVIDER_SPLIT` disponível para API e Bots.

## Sequência de Rollout (Big Bang)

1. Deploy da API com suporte ao envelope canônico de entrada e dispatcher de saída.
2. Deploy do Bots com worker de `adapter-output` e DLQ `adapter-output-dlq`.
3. Validar saúde operacional:
   - API: `GET /admin/queues` (Bull Board) com fila `adapter-output` visível.
   - Bots: `GET /health` e `GET /health/outgoing`.
4. Ativar `PROVIDER_SPLIT=true` simultaneamente em API e Bots.
5. Monitorar por 15-30 minutos:
   - backlog da `adapter-output`
   - crescimento da `adapter-output-dlq`
   - taxa de erro dos adapters por canal
6. Se estável, concluir cutover e manter monitoramento normal.

## Verificações Pós-Cutover

- `adapter-output` com fila fluindo (jobs entram e saem sem acúmulo persistente).
- `adapter-output-dlq` com crescimento zero ou residual controlado.
- Discord inicializado apenas no Bots quando split ativo.
- API não inicializa Discord com split ativo.
- Mensagens de saída chegando em Telegram/WhatsApp/Discord.

## Alertas Recomendados

- `adapter-output.waiting` acima do baseline por mais de 5 minutos.
- Qualquer crescimento contínuo de `adapter-output-dlq` por mais de 2 minutos.
- Falhas repetidas por `providerName` no worker de Bots.
- Queda abrupta de throughput de saída após ativar split.

## Rollback

Se ocorrer degradação crítica:

1. Desativar `PROVIDER_SPLIT` na API e no Bots.
2. Reiniciar processos para reaplicar bootstrap dos adapters.
3. Validar retomada do envio direto pela API.
4. Preservar `adapter-output-dlq` para análise de causa raiz.
5. Abrir incidente com:
   - erro dominante
   - canal afetado
   - volume de mensagens impactadas

## Troubleshooting Rápido

- Sem consumo em `adapter-output`: validar conectividade Redis do Bots e worker ativo.
- DLQ crescendo: inspecionar payload canônico e credenciais do provider afetado.
- Mensagem duplicada: verificar logs de dedupe por `idempotencyKey`.
- Sem snapshot em `GET /health/outgoing`: confirmar bootstrap do Bots com provider de snapshot configurado.
