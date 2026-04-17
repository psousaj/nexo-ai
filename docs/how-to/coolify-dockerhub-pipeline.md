# Pipeline Docker Hub + Coolify (API)

Este fluxo tira o peso de build do servidor do Coolify.

## Visao geral

1. GitHub Actions builda a imagem usando `apps/api/Dockerfile`.
2. A imagem e enviada para o Docker Hub.
3. O workflow dispara o webhook de deploy do Coolify.
4. Opcionalmente, o workflow espera o healthcheck ficar `200` antes de finalizar.

Resultado: o Coolify so faz pull e sobe o container. Nao compila mais no droplet.

## Arquivo do workflow

- Workflow criado em `.github/workflows/api-image-coolify.yml`.
- Gatilhos:
  - `push` na branch `development`
  - `workflow_dispatch` (manual)

Tags publicadas no Docker Hub:

- `<usuario>/nexo-api:development`
- `<usuario>/nexo-api:development-<sha-curto>`

## Secrets necessarios no GitHub

Configure em **Settings > Secrets and variables > Actions**:

- `DOCKERHUB_USERNAME`: usuario do Docker Hub.
- `DOCKERHUB_TOKEN`: access token do Docker Hub.
- `COOLIFY_DEPLOY_WEBHOOK`: URL de deploy webhook do app no Coolify (opcional, mas recomendado para deploy automatico).
- `COOLIFY_HEALTHCHECK_URL`: URL de healthcheck da API (opcional, para o workflow esperar o app subir).

## Configuracao no Coolify

1. Crie/edite o app como **Docker Image** (nao como app de build via Git).
2. Imagem: `docker.io/<DOCKERHUB_USERNAME>/nexo-api:development`.
3. Configure credencial do registry se o repo for privado.
4. Habilite pull da tag no deploy (politica de pull sempre que disponivel).
5. Copie o deploy webhook do app e salve em `COOLIFY_DEPLOY_WEBHOOK` no GitHub.

## Como o Coolify "espera" a pipeline

O Coolify nao precisa esperar ativamente o GitHub.
Quem controla a ordem e o workflow:

1. build e push concluem com sucesso
2. so depois o workflow chama o webhook do Coolify

Se voce definir `COOLIFY_HEALTHCHECK_URL`, a pipeline ainda espera o app ficar saudavel antes de marcar sucesso.

## Dica de rollback rapido

- Mantenha tags por commit (`development-<sha-curto>`).
- Em incidente, aponte temporariamente o app no Coolify para uma tag SHA anterior conhecida.
