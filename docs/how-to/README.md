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

### **[Deployment Cloudflare](deployment-cloudflare.md)**

Deploy em produção no Cloudflare Workers.

- Criar conta Cloudflare
- Deploy da API
- Configurar webhooks
- Configurar domínio customizado

**Use quando:** Fazer deploy para produção

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

1. [Deployment Cloudflare](deployment-cloudflare.md)
2. [Troubleshooting](troubleshooting.md) - Se algo der errado

### Testar Evolution Local

1. [Evolution em Docker (Dev)](evolution-dev.md)
2. [Troubleshooting](troubleshooting.md)

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
