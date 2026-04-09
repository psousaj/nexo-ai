# Evolution em Docker (Dev)

Guia para subir a Evolution API localmente em container e integrar com a API do Nexo em desenvolvimento.

## Objetivo

Rodar a Evolution API em ambiente local com Docker Compose dedicado, mantendo Redis/Postgres externos, e preparar o Nexo para consumir a instância via variáveis de ambiente.

## Pré-requisitos

- Docker com `docker compose`
- Postgres externo acessível
- Redis externo acessível
- Repositório do Nexo com `.env` configurado

## 1. Configurar env da Evolution

```bash
cp docker/evolution/.env.example docker/evolution/.env
```

Edite `docker/evolution/.env` com:

- `AUTHENTICATION_API_KEY`
- `DATABASE_CONNECTION_URI`
- `CACHE_REDIS_URI`

## 2. Subir container da Evolution

```bash
docker compose -f docker-compose.evolution.dev.yml up -d
```

Para parar:

```bash
docker compose -f docker-compose.evolution.dev.yml down
```

## 3. Validar API da Evolution

```bash
curl --request GET \
  --url http://localhost:8080/ \
  --header 'apikey: CHANGE_ME'
```

Resposta esperada: mensagem de welcome com status 200.

## 4. Configurar env do Nexo

No `.env` raiz do Nexo:

```bash
EVOLUTION_API_BASE_URL=http://localhost:8080
EVOLUTION_API_KEY=CHANGE_ME
EVOLUTION_INSTANCE_NAME=nexo-dev
EVOLUTION_WEBHOOK_SECRET=change-webhook-secret
EVOLUTION_WEBHOOK_PATH=/webhook/whatsapp/evolution
EVOLUTION_BOOTSTRAP_ENABLED=true
EVOLUTION_BOOTSTRAP_TIMEOUT_MS=15000
```

## 5. Rodar API do Nexo

```bash
pnpm dev:api
```

## 6. Validar integração webhook

Nesta migração, a entrada oficial será:

- `POST /webhook/whatsapp/evolution`

A API do Nexo deve validar `EVOLUTION_WEBHOOK_SECRET` via header antes de enfileirar mensagens.

## 7. Operação da instância via Dashboard/API

Endpoints de suporte para operação da instância Evolution no backend:

- `GET /api/admin/whatsapp-settings`
- `POST /api/admin/whatsapp-settings/bootstrap`
- `GET /api/admin/whatsapp-settings/qr-code`
- `POST /api/admin/whatsapp-settings/evolution/connect`
- `POST /api/admin/whatsapp-settings/evolution/restart`
- `POST /api/admin/whatsapp-settings/evolution/disconnect`

## 8. Fluxo no Dashboard (admin/settings)

O painel de configuração WhatsApp foi simplificado para provider único Evolution.

Fluxo recomendado:

1. Clicar em `Bootstrap Instância`.
2. Clicar em `Conectar` para obter QR Code.
3. Escanear QR no WhatsApp para vincular a sessão.
4. Usar `Reiniciar Sessão` ou `Desconectar` quando necessário.

## Troubleshooting rápido

- `401 Unauthorized` no Evolution: verifique `apikey`.
- `connection refused` para banco/redis: revisar URIs externas no `docker/evolution/.env`.
- Evolution sobe mas Nexo não conecta: validar `EVOLUTION_API_BASE_URL` e `EVOLUTION_API_KEY` no `.env` do Nexo.
