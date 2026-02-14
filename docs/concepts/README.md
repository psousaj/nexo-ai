# Concepts - Nexo AI

Conceitos fundamentais e arquitetura do sistema.

## 💡 Conceitos Disponíveis

### **[Visão Geral da Arquitetura](architecture-overview.md)** ⭐ Comece aqui

Entenda como o Nexo AI funciona sob o capô.

- Camadas da arquitetura
- Fluxo de dados completo
- Componentes principais
- Princípios arquiteturais
- Performance e custos

**Leia quando:** Querer entender o sistema como um todo

---

### **[Controle Runtime Determinístico](deterministic-runtime.md)**

Pattern Hugging Face Agents implementado no v0.3.0.

- Schema JSON canônico
- Tools com contratos fortes
- Eliminação de conversação livre
- Ações determinísticas sem LLM
- Validação de resposta

**Leia quando:** Querer entender o padrão de orquestração de agentes

---

### **[State Machine](state-machine.md)**

Máquina de estados de conversação.

- Estados e transições
- Context persistido
- Multi-turn conversations
- Por que usar state machine

**Leia quando:** Precisar entender fluxos conversacionais

---

### **[Sistema de Conversação](conversation-system.md)**

Multi-turn interactions e context management.

- Pending actions
- Confirmações
- Timeouts
- Limpeza de contexto

**Leia quando:** Trabalhar com conversas multi-turn

---

## 🎯 Por Onde Começar?

### Para Entender o Sistema

1. [Visão Geral da Arquitetura](architecture-overview.md)
2. [Controle Runtime Determinístico](deterministic-runtime.md)
3. [State Machine](state-machine.md)

### Para Implementar Features

1. [Controle Runtime Determinístico](deterministic-runtime.md)
2. [Tools Reference](../reference/tools-reference.md)
3. [Implementation Checklist](../reference/implementation-checklist.md)

### Para Debugar Problemas

1. [State Machine](state-machine.md)
2. [Sistema de Conversação](conversation-system.md)
3. [ADRs](../adr/README.md) - Decisões arquiteturais

---

## 📚 Próximos Passos

Depois de entender os conceitos:

- 🛠️ [How-To Guides](../how-to/README.md) - Aplicar conhecimento
- 📋 [Reference](../reference/README.md) - Consulta técnica
- 📐 [ADRs](../adr/README.md) - Decisões arquiteturais

---

## 🎓 Aprofundamento

### Padrões de Design

- [Hugging Face Agents](https://huggingface.co/docs/transformers/main/en/agents) - Base do nosso padrão determinístico
- [State Machines](https://www.stateful.com/blog/the-state-pattern-and-state-machines) - Padrão de projeto

### Arquitetura de Sistemas

- [Provider-Agnostic Design](../adr/005-ai-agnostic.md) - ADR-005
- [JSONB Metadata](../adr/003-jsonb-metadata.md) - ADR-003
- [AI-Agnostic Architecture](../adr/005-ai-agnostic.md) - ADR-005

---

**Precisa de ajuda?** Abra uma [issue no GitHub](https://github.com/psousaj/nexo-ai/issues)
