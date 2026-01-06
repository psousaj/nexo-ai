# Índice da Documentação

Guia rápido para navegar pela documentação do Nexo AI.

## 🚀 Começando

Para quem está iniciando no projeto:

1. **[README.md](../README.md)** - Visão geral do projeto
2. **[STACK.md](STACK.md)** - Entenda as tecnologias usadas
3. **[ENV.md](ENV.md)** - Configure seu ambiente local
4. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Faça seu primeiro deploy

## 🏗️ Entendendo a Arquitetura

Para compreender como o sistema funciona:

1. **[ARQUITETURA.md](ARQUITETURA.md)** - Visão geral, camadas e fluxos
2. **[SCHEMA.md](SCHEMA.md)** - Estrutura do banco de dados
3. **[ESTRUTURA.md](ESTRUTURA.md)** - Organização de código
4. **[adr/](adr/README.md)** - Architecture Decision Records (por quê das escolhas)

## 📖 Referência Técnica

Documentação detalhada para desenvolvimento:

- **[ENDPOINTS.md](ENDPOINTS.md)** - Todos os endpoints da API REST
- **[METADA.md](METADA.md)** - Estruturas de metadados por tipo
- **[ROADMAP.md](ROADMAP.md)** - Planejamento de features

## 📋 Fluxo de Trabalho Sugerido

### Novo Desenvolvedor

```
1. README.md (visão geral)
   ↓
2. STACK.md (conhecer tecnologias)
   ↓
3. ENV.md (configurar ambiente)
   ↓
4. ARQUITETURA.md (entender sistema)
   ↓
5. ESTRUTURA.md (navegar código)
```

### Implementando Features

```
1. ROADMAP.md (ver o que fazer)
   ↓
2. ARQUITETURA.md (onde implementar)
   ↓
3. SCHEMA.md (alterar banco?)
   ↓
4. ENDPOINTS.md (novos endpoints?)
```

### Deploy

```
1. ENV.md (secrets configurados?)
   ↓
2. DEPLOYMENT.md (seguir checklist)
```

## 🔍 Busca Rápida

**Preciso saber...**

| O que                  | Onde encontrar                   |
| ---------------------- | -------------------------------- |
| Como rodar localmente  | [README.md](../README.md)        |
| Quais tecnologias usar | [STACK.md](STACK.md)             |
| Como configurar .env   | [ENV.md](ENV.md)                 |
| Como funciona o fluxo  | [ARQUITETURA.md](ARQUITETURA.md) |
| Estrutura do banco     | [SCHEMA.md](SCHEMA.md)           |
| Onde fica cada código  | [ESTRUTURA.md](ESTRUTURA.md)     |
| Endpoints disponíveis  | [ENDPOINTS.md](ENDPOINTS.md)     |
| Formato de metadados   | [METADA.md](METADA.md)           |
| Como fazer deploy      | [DEPLOYMENT.md](DEPLOYMENT.md)   |
| Próximas features      | [ROADMAP.md](ROADMAP.md)         |

## 📝 Convenções

Ao ler a documentação:

- **Negrito** = conceitos importantes
- `código` = valores literais, nomes de arquivos
- `blocos` = exemplos de código
- > citações = notas importantes
- ⚠️ = avisos de segurança ou cuidado
- ✅ = boas práticas
- 🚧 = features em desenvolvimento

## 💡 Contribuindo com a Documentação

Ao adicionar ou modificar docs:

1. Mantenha linguagem clara e direta
2. Use exemplos práticos
3. Adicione ao índice se for novo documento
4. Atualize links relacionados
5. Revise ortografia e formatação
