# BMAD Agents - Nexo AI

Referência completa de agentes BMAD (Breakthrough Method of Agile AI Driven Development) aplicados ao Nexo AI.

## 🤖 O que são BMAD Agents?

**BMAD Agents** são especialistas em domínio que guiam você através de processos estruturados de desenvolvimento. Cada agente representa uma disciplina diferente:

- **Product Manager (PM)** - Definição de produto e requisitos
- **Architect** - Design técnico e decisões arquiteturais
- **Developer** - Implementação e código
- **UX Designer** - Experiência do usuário
- **Scrum Master** - Facilitação e processo

---

## 🎯 Agentes no Nexo AI

### 1. Product Manager (PM)

**Responsabilidade**: Definir **o que** construir e **por que**.

**Atividades**:

- Escrever Product Briefs
- Criar PRDs (Product Requirements Documents)
- Definir métricas de sucesso
- Priorizar features

**Documentos**:

- [Roadmap](roadmap.md) - Planejamento de versões
- [ADRs](../adr/README.md) - Decisões de produto

**Exemplo de Output**:

```markdown
# Product Brief: Busca Semântica

## Problema
Usuários não conseguem encontrar itens salvos com linguagem natural.

## Solução
Implementar busca semântica usando embeddings.

## Métricas de Sucesso
- Precisão@1: >90%
- Latência <500ms
- Custo < $5/mês
```

---

### 2. Architect

**Responsabilidade**: Definir **como** construir (design técnico).

**Atividades**:

- Criar arquitetura de sistemas
- Escrever ADRs (Architecture Decision Records)
- Definir princípios e padrões
- Avaliar trade-offs

**Documentos**:

- [Visão Geral da Arquitetura](../concepts/architecture-overview.md)
- [ADRs](../adr/README.md)
- [Controle Runtime Determinístico](../concepts/deterministic-runtime.md)

**Exemplo de Output**:

```markdown
# ADR-011: Controle Runtime Determinístico

## Contexto
LLM decidindo tudo causou imprevisibilidade.

## Decisão
Implementar pattern Hugging Face Agents:
- LLM = planner (JSON only)
- Runtime = executor
- Tools = contratos fortes

## Consequências
+ Previsibilidade total
- Mais código explicito
```

---

### 3. Developer

**Responsabilidade**: Implementar código de produção.

**Atividades**:

- Escrever código limpo e testável
- Implementar features seguindo especificações
- Escrever testes (unit, integration, e2e)
- Documentar código complexo

**Documentos**:

- [Implementation Checklist](implementation-checklist.md)
- [Tools Reference](tools-reference.md)
- [Database Schema](database-schema.md)
- [API Endpoints](api-endpoints.md)

**Exemplo de Output**:

```typescript
// src/services/tools/save-movie.ts

export async function saveMovie(
  context: RequestContext,
  args: SaveMovieArgs
): Promise<ToolOutput> {
  // 1. Validar entrada
  if (!args.title) {
    throw new ToolError('title is required');
  }

  // 2. Enriquecer metadata (TMDB)
  const metadata = await tmdbService.getMovieDetails(args.tmdb_id);

  // 3. Gerar embedding
  const embedding = await embeddingService.generateEmbedding(
    prepareTextForEmbedding('movie', args.title, metadata)
  );

  // 4. Salvar no banco
  const item = await db.insert(memoryItems).values({
    type: 'movie',
    title: args.title,
    metadata,
    embedding,
    userId: context.userId,
  });

  return {
    success: true,
    message: `✅ ${args.title} (${metadata.year}) salvo!`,
    data: item,
  };
}
```

---

### 4. UX Designer

**Responsabilidade**: Criar experiência fluida para o usuário.

**Atividades**:

- Design de interações conversacionais
- Escrever mensagens e prompts
- Testar UX com usuários
- Criar flows de onboarding

**Documentos**:

- [Getting Started](../tutorials/getting-started.md)
- [Exemplos de Uso](../README.md#exemplos-de-uso)

**Exemplo de Output**:

```typescript
// Mensagens determinísticas (sem LLM)

export const GENERIC_CONFIRMATION = '✅ Salvo com sucesso!';
export const NO_ITEMS_FOUND = '🔍 Nenhum item encontrado.';
export const CASUAL_GREETINGS = ['Oi!', 'Olá!', 'Como posso ajudar?'];

// Formatação de resultados
export function formatItemsList(items: Item[]): string {
  return items.map((item, i) =>
    `${i + 1}. ${item.title} (${item.metadata.year}) ⭐ ${item.metadata.rating}`
  ).join('\n');
}
```

---

### 5. Scrum Master

**Responsabilidade**: Facilitar processo e remover bloqueios.

**Atividades**:

- Organizar sprints e ciclos de desenvolvimento
- Facilitar reuniões (daily, retro, planning)
- Remover impedimentos
- Melhorar processo continuamente

**Documentos**:

- [Roadmap](roadmap.md) - Planejamento de versões
- [Implementation Checklist](implementation-checklist.md) - Status de tasks

**Exemplo de Output**:

```markdown
# Sprint Planning - v0.3.0

## Objetivo
Implementar controle runtime determinístico.

## Stories
1. Schema canônico AgentLLMResponse
2. 11 tools específicas
3. Eliminar conversação livre
4. Ações determinísticas

## Status
✅ Completo - 11/01/2026
```

---

## 🔄 Como os Agents Trabalham Juntos

### Exemplo 1: Nova Feature (Busca Semântica)

```
1. PM: Define problema (usuários não encontram itens)
   ↓
2. Architect: Propõe solução (embeddings + pgvector)
   ↓
3. PM: Prioriza (v0.3.2 - alta prioridade)
   ↓
4. Developer: Implementa (embedding-service.ts)
   ↓
5. UX: Testa mensagens ("encontrei filmes sobre sonhos")
   ↓
6. Scrum Master: Facilita review e deploy
```

### Exemplo 2: Bug (Imprevisibilidade do LLM)

```
1. PM: Reporta bug ("deleta tudo" às vezes não funciona)
   ↓
2. Architect: Analisa causa (LLM decidindo tudo)
   ↓
3. Architect: Escreve ADR-011 (controle determinístico)
   ↓
4. Developer: Refatora (schema JSON + tools específicas)
   ↓
5. Developer: Escreve testes (determinismo 100%)
   ↓
6. Scrum Master: Atualiza checklist
```

---

## 🎯 Quando Usar Cada Agente

### Product Manager
- ✅ Definir nova feature
- ✅ Escrever PRD
- ✅ Priorizar backlog
- ✅ Definir métricas

### Architect
- ✅ Design de sistema
- ✅ Escolher tecnologias
- ✅ Escrever ADRs
- ✅ Avaliar trade-offs

### Developer
- ✅ Implementar features
- ✅ Escrever testes
- ✅ Refatorar código
- ✅ Documentar APIs

### UX Designer
- ✅ Design de interações
- ✅ Escrever mensagens
- ✅ Testar com usuários
- ✅ Criar onboarding

### Scrum Master
- ✅ Organizar sprints
- ✅ Facilitar reuniões
- ✅ Remover bloqueios
- ✅ Melhorar processo

---

## 📚 Workflows BMAD no Nexo AI

### 1. Product Brief → PRD → Architecture

**Quando**: Nova feature ou mudança significativa.

**Steps**:

1. **PM** escreve Product Brief (problema + solução alta nível)
2. **PM** expande para PRD completo (requisitos, personas, métricas)
3. **Architect** cria design técnico (arquitetura, componentes, ADRs)
4. **Developer** quebra em stories técnicas

**Exemplo**: [Busca Semântica](../concepts/deterministic-runtime.md)

---

### 2. Bug Report → ADR → Refactor

**Quando**: Problema arquitetural ou padrão errado.

**Steps**:

1. **PM/Developer** reporta bug com evidências
2. **Architect** analisa causa raiz
3. **Architect** escreve ADR com decisão
4. **Developer** implementa refatoração
5. **Developer** escreve testes regressão

**Exemplo**: [ADR-011: Controle Runtime Determinístico](../adr/011-deterministic-runtime-control.md)

---

### 3. Daily Scrum → Impediment → Resolution

**Quando**: Bloqueios durante sprint.

**Steps**:

1. **Developer** reporta impedimento na daily
2. **Scrum Master** captura e prioriza
3. **Architect** ou **PM** ajudam a resolver
4. **Developer** desbloqueado e continua

**Exemplo**: "TMDB API mudou response format" → Architect atualiza service

---

## 🚀 Começando com BMAD Agents

### Para Novos Projetos

1. Instale BMAD Method:
   ```bash
   npx bmad-method install --directory /path/to/project --modules bmm
   ```

2. Carregue agentes no seu AI IDE (Claude Code, Cursor, Windsurf)

3. Comece com `/product-brief` para definir primeiro produto

### Para Projetos Existentes

1. Leia [ADRs do Nexo AI](../adr/README.md) para exemplos
2. Consulte [Implementation Checklist](implementation-checklist.md)
3. Use `/bmad-help` para guia interativo

---

## 📖 Referências

- [BMAD Method Official](https://github.com/bmad-code-org/BMAD-METHOD)
- [ADRs do Nexo AI](../adr/README.md)
- [Implementation Checklist](implementation-checklist.md)
- [Roadmap](roadmap.md)

---

**Última atualização**: 14 de fevereiro de 2026
