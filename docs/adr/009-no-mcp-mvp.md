# ADR-009: MCP Server é Opcional no MVP

**Status**: accepted

**Data**: 2026-01-10

## Contexto

O Model Context Protocol (MCP) permite expor resources, tools e prompts para Claude Desktop e outros clients MCP. Há discussão se devemos implementar MCP no MVP ou adiar para versões futuras.

**Benefícios do MCP:**
- Integração com Claude Desktop/CLI
- API estruturada para clients externos
- Composição com outros MCP servers (ex: Supabase MCP)
- Padrão emerging para AI tooling

**Custos:**
- Adiciona complexidade ao codebase
- Requer manutenção de mais uma API surface
- MVP não tem demanda de integração externa
- Usuários finais não usam Claude Desktop

## Decisão

MCP Server será **OPCIONAL** e implementado **apenas em v1.0+** quando houver:

1. **Demanda confirmada** de integração com Claude Desktop
2. **Necessidade de API pública** estruturada para third-party
3. **Casos de uso concretos** para composição com outros MCPs

MVP (v0.2.0-v0.4.0) foca em:
- ✅ Bot funcional via Telegram/WhatsApp
- ✅ Tool calling interno (LLM → backend services)
- ✅ UX do usuário final
- ❌ Integrações externas (MCP)

## Consequências

### Positivas

- **Foco no MVP**: recursos dedicados a features core
- **Menos complexidade**: codebase mais simples de manter
- **Validação primeiro**: implementa MCP após validar produto
- **Flexibilidade**: pode escolher melhor momento para adicionar

### Negativas

- **Não integrável** com Claude Desktop no MVP
- **Sem API pública** estruturada (apenas REST endpoints internos)
- **Refactor futuro** se precisar adicionar MCP depois

## Implementação Futura (v1.0+)

Quando implementar MCP:

```typescript
// mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk";

const server = new Server({
  name: "nexo-ai",
  version: "1.0.0",
});

// Resources (read-only)
server.resource("nexo://items/{userId}", async (params) => {
  return await itemService.getUserItems(params.userId);
});

// Tools (actions)
server.tool("save_item", async (params) => {
  return await itemService.createItem(params);
});

// Prompts (templates)
server.prompt("classify_content", (params) => {
  return `Classifique este conteúdo: ${params.content}`;
});
```

**Composição com Supabase MCP:**
```json
{
  "mcpServers": {
    "nexo-ai": {
      "command": "node",
      "args": ["/path/to/nexo/mcp.js"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-supabase"]
    }
  }
}
```

## Alternativas Consideradas

1. **Implementar MCP no MVP**: Overhead desnecessário sem demanda
2. **REST API pública como alternativa**: Mais simples e conhecida
3. **GraphQL**: Overkill para este projeto

## Referências

- [MCP Specification](https://modelcontextprotocol.io/docs/specification)
- [Supabase MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/supabase)
- Roadmap v0.2.0: foco em tool calling interno
