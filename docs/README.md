# Nexo AI - Documentação

Bem-vindo à documentação oficial do **Nexo AI** - assistente pessoal via Telegram que organiza, categoriza e enriquece automaticamente conteúdo usando IA.

## 📚 Estrutura da Documentação

Esta documentação segue o padrão **BMAD (Breakthrough Method of Agile AI Driven Development)**, organizada em 4 categorias principais:

### 📖 [Tutorials](tutorials/README.md)
**Guias passo a passo** para começar do zero.

- **[Getting Started](tutorials/getting-started.md)** - Instalação e primeiro uso em 5 minutos
- **[Setup de Ambiente](tutorials/setup-environment.md)** - Configuração completa de variáveis de ambiente
- **[Primeiro Deploy](tutorials/first-deployment.md)** - Deploy no Cloudflare Workers

### 🛠️ [How-To Guides](how-to/README.md)
**Guias práticos** para tarefas específicas.

- **[Busca Avançada](how-to/advanced-search.md)** - Filtros avançados e queries complexas
- **[Busca Semântica](how-to/semantic-search.md)** - Sistema de embeddings e cache
- **[Evolution em Docker (Dev)](how-to/evolution-dev.md)** - Subir Evolution local para testes de WhatsApp
- **[Deployment Cloudflare](how-to/deployment-cloudflare.md)** - Deploy em produção
- **[Troubleshooting](how-to/troubleshooting.md)** - Solução de problemas comuns

### 💡 [Concepts](concepts/README.md)
**Conceitos fundamentais** e arquitetura do sistema.

- **[Visão Geral da Arquitetura](concepts/architecture-overview.md)** - Camadas, fluxos e componentes
- **[Controle Runtime Determinístico](concepts/deterministic-runtime.md)** - Pattern Hugging Face Agents
- **[State Machine](concepts/state-machine.md)** - Máquina de estados de conversação
- **[Sistema de Conversação](concepts/conversation-system.md)** - Multi-turn interactions

### 📋 [Reference](reference/README.md)
**Referência técnica** detalhada.

- **[Implementation Checklist](reference/implementation-checklist.md)** - Status da refatoração v0.3.0
- **[API Endpoints](reference/api-endpoints.md)** - Refer completa da API REST
- **[Database Schema](reference/database-schema.md)** - Estrutura do banco de dados
- **[Tools Reference](reference/tools-reference.md)** - 11 tools do agente determinístico

### 📐 [Architecture Decision Records (ADRs)](adr/README.md)
**Decisões arquiteturais** e seu histórico.

- Ver todos os [ADRs](adr/README.md) para entender decisões passadas

---

## 🚀 Quick Start

```bash
# 1. Instalar dependências
bun install

# 2. Configurar environment
cp .env.example .env
# Edite .env com suas credenciais

# 3. Setup database
bun run db:push

# 4. Rodar em desenvolvimento
bun run dev
```

**API disponível em:** `http://localhost:3001`
**Documentação OpenAPI:** `http://localhost:3001/reference`

---

## 🎯 O que faz?

O Nexo AI organiza automaticamente:

- 🎬 **Filmes e Séries** - Enriquecimento via TMDB
- 📺 **Vídeos do YouTube** - Metadados automáticos
- 🔗 **Links** - OpenGraph scraping
- 📝 **Notas** - Texto livre

### Exemplo de uso

```
Você: "clube da luta"
Bot: Encontrei 2 filmes:
     1. Fight Club (1999) - David Fincher ⭐ 8.8
     2. The Fight Club (2020)
     Qual você quer salvar?

Você: "1"
Bot: ✅ Fight Club (1999) salvo!
     Disponível em: Netflix, Amazon Prime
```

---

## 📁 Estrutura do Projeto

```
nexo-ai/
├── apps/
│   ├── api/              # API principal (Bun + Elysia)
│   ├── dashboard/        # Dashboard web (Vue 3)
│   ├── landing/          # Landing page (Vite)
│   └── old-dashboard/    # Dashboard legado
├── docs/                 # Documentação (esta página)
├── packages/             # Packages compartilhados
└── package.json          # Monorepo root
```

---

## 🛠️ Stack Tecnológico

| Categoria         | Tecnologia                      |
| ----------------- | ------------------------------- |
| **Runtime**       | Bun                             |
| **Framework**     | Elysia                          |
| **Database**      | PostgreSQL (Supabase)           |
| **ORM**           | Drizzle                         |
| **Deploy**        | Cloudflare Workers / Docker     |
| **Chat**          | Telegram Bot API                |
| **AI**            | Google Gemini + Cloudflare AI   |
| **Enrichment**    | TMDB, YouTube, OpenGraph        |
| **Cache**         | Redis (Upstash)                 |
| **Docs**          | OpenAPI/Scalar                  |

---

## 🎯 Versão Atual

**v0.3.0** - Arquitetura Determinística Completa ✅

- ✅ **Controle runtime determinístico** - LLM apenas planeja, código executa
- ✅ **Schema JSON único** - `AgentLLMResponse` validado
- ✅ **11 tools específicas** - Contratos fortes e determinísticos
- ✅ **Zero conversação livre** - LLM nunca pergunta "quer que eu salve?"
- ✅ **Ações determinísticas** - delete_all, list_all sem LLM
- ✅ **Sistema de cache** - Redis para APIs externas
- ✅ **Busca semântica** - PostgreSQL Vector + embeddings

---

## 📖 Documentação Importante

### Para Começar
- [Getting Started](tutorials/getting-started.md)
- [Setup de Ambiente](tutorials/setup-environment.md)

### Para Entender
- [Visão Geral da Arquitetura](concepts/architecture-overview.md)
- [Controle Runtime Determinístico](concepts/deterministic-runtime.md)

### Para Implementar
- [Implementation Checklist](reference/implementation-checklist.md)
- [Tools Reference](reference/tools-reference.md)

### Decisões Arquiteturais
- [ADRs](adr/README.md) - Todas as decisões de arquitetura

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Leia os [ADRs](adr/README.md) para entender decisões arquiteturais
2. Consulte o [Implementation Checklist](reference/implementation-checklist.md)
3. Siga o padrão determinístico v0.3.0
4. Abra um PR com mudanças descritas

---

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/psousaj/nexo-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/psousaj/nexo-ai/discussions)

---

**Última atualização**: 14 de fevereiro de 2026
