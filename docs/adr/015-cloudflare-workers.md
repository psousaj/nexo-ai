# ADR-001: Cloudflare Workers como Plataforma de Deploy

**Status**: accepted

**Data**: 2026-01-05

## Contexto

Precisamos de uma plataforma serverless para deploy do assistente WhatsApp que seja:

- Custo-efetiva para MVP
- Baixa latência global
- Fácil integração com Supabase
- Simples de deployar

## Decisão

Usar **Cloudflare Workers** como plataforma principal de deploy.

## Consequências

### Positivas

- **Edge computing**: execução próxima aos usuários (baixa latência)
- **Custo**: 100k requests/dia grátis
- **DX**: integração nativa com Supabase via HTTP
- **Escalabilidade**: automática sem configuração

### Negativas

- **CPU limit**: 50ms (free) / 30s (paid) - requer código otimizado
- **Memory**: 128MB - não serve para ML pesado
- **Cold starts**: mínimos mas existem
- **Vendor lock-in**: código específico Workers (mas adaptável)

## Alternativas Consideradas

1. **Railway/Render**: Mais flexível mas custo maior (~$5/mês mínimo)
2. **AWS Lambda**: Mais complexo de configurar, cold starts piores
3. **Fly.io**: Boa alternativa mas menos edge locations
4. **VPS tradicional**: Mais trabalho operacional, sem auto-scaling

## Mitigações

- Usar `waitUntil()` para operações não-bloqueantes
- Cache externo (KV) para reduzir CPU time
- Bundle size otimizado (< 1MB)
