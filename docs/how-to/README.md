# How-To Guides - Nexo AI

Guias práticos para tarefas específicas.

## 🛠️ Guias Disponíveis

### **[Busca Avançada](advanced-search.md)**

Filtros avançados e queries complexas.

- Filtro por tipo (movie, tv_show, note, etc)
- Filtrar por ano (yearRange)
- Filtrar por streaming disponível
- Filtrar por rating mínimo
- Filtrar por gêneros
- Ordenação por created, rating, year
- Exemplos combinados

**Use quando:** Precisar encontrar itens específicos com filtros

---

### **[Busca Semântica](semantic-search.md)**

Sistema de embeddings e cache para busca inteligente.

- Cache de APIs externas (Redis)
- Sistema de embeddings (PostgreSQL Vector)
- Modelo Cloudflare Workers AI
- Busca vetorial vs busca tradicional
- Troubleshooting comum

**Use quando:** Querer entender como busca semântica funciona

---

### **[Evolution em Docker (Dev)](evolution-dev.md)**

Subir Evolution API local com Docker Compose para testes de integração no Nexo.

- Compose dedicado para ambiente de desenvolvimento
- Configuração de `.env` da Evolution
- Verificação de health e autenticação por `apikey`
- Fluxo de integração com webhook do Nexo

**Use quando:** Precisar testar WhatsApp Evolution self-hosted localmente

---

### **[Cutover Provider Split](provider-split-cutover.md)**

Checklist de rollout para split de providers entre API (ingress/core) e Bots (egress/adapters).

- Sequência big bang de ativação
- Verificações de saúde (`adapter-output` e `adapter-output-dlq`)
- Alertas recomendados e rollback
- Troubleshooting operacional

**Use quando:** Ativar ou reverter `PROVIDER_SPLIT` em ambiente real

---

### **[Deployment Cloudflare](deployment-cloudflare.md)**

Deploy em produção no Cloudflare Workers.

- Criar conta Cloudflare
- Deploy da API
- Configurar webhooks
- Configurar domínio customizado

**Use quando:** Fazer deploy para produção

---

### **[Pipeline Docker Hub + Coolify](coolify-dockerhub-pipeline.md)**

Build da imagem no GitHub Actions, push no Docker Hub e deploy no Coolify por webhook.

- Build fora do servidor de produção
- Push de tags por branch e por commit
- Trigger de deploy no Coolify apenas apos imagem pronta
- Espera opcional por healthcheck antes de concluir pipeline

**Use quando:** Quiser tirar carga de CPU do servidor e usar pull de imagem no Coolify

---

### **[Troubleshooting](troubleshooting.md)**

Solução de problemas comuns.

- Bot não responde
- Erro de database
- TMDB/YouTube não funcionam
- Redis não conecta
- Embedding falha

**Use quando:** Encontrar erro ou comportamento inesperado

---

## 🎯 Guia Rápido por Tarefa

### Encontrar Itens Específicos

1. [Busca Avançada](advanced-search.md) - Filtros por ano, gênero, rating

### Entender Busca Semântica

1. [Busca Semântica](semantic-search.md) - Como embeddings funcionam
2. [Visão Geral da Arquitetura](../concepts/architecture-overview.md) - Camadas do sistema

### Deploy em Produção

1. [Pipeline Docker Hub + Coolify](coolify-dockerhub-pipeline.md)
2. [Deployment Cloudflare](deployment-cloudflare.md)
3. [Troubleshooting](troubleshooting.md) - Se algo der errado

### Testar Evolution Local

1. [Evolution em Docker (Dev)](evolution-dev.md)
2. [Troubleshooting](troubleshooting.md)

### Executar Cutover de Providers

1. [Cutover Provider Split](provider-split-cutover.md)
2. [Observabilidade](../observability.md)

### Debugar Problemas

1. [Troubleshooting](troubleshooting.md)
2. [ADRs](../adr/README.md) - Decisões arquiteturais

---

## 📚 Relacionado

- 📖 [Tutorials](../tutorials/README.md) - Começar do zero
- 💡 [Concepts](../concepts/README.md) - Entender conceitos
- 📋 [Reference](../reference/README.md) - Referência técnica

---

**Precisa de ajuda?** Abra uma [issue no GitHub](https://github.com/psousaj/nexo-ai/issues)
