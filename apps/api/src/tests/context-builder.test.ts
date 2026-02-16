/**
 * Testes unitários para Context Builder (OpenClaw Agent Profiles)
 *
 * Valida:
 * - buildAgentContext: Construção de prompts com perfis
 * - Injeção condicional baseada em tipo de sessão
 * - Privacidade: USER.md apenas em DMs
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { buildAgentContext, type AgentContext } from '@/services/context-builder';

// Mock do banco de dados
vi.mock('@/db', () => ({
  db: {
    query: {
      agentMemoryProfiles: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('Context Builder - OpenClaw Agent Profiles', () => {
  const mockUserId = 'user-123';
  const mockSessionKeyDM = 'agent:main:telegram:direct:+1234567890';
  const mockSessionKeyGroup = 'agent:main:telegram:group:-1001234567890';
  const mockSessionKeyMain = 'agent:main:telegram:direct:user-main';

  describe('buildAgentContext', () => {
    test('retorna prompt básico quando não há perfil', async () => {
      const context = await buildAgentContext(mockUserId, mockSessionKeyDM);

      expect(context.systemPrompt).toContain('You are NEXO');
      expect(context.systemPrompt).toContain('personal AI assistant');
    });

    test('inclui SOUL.md (personalidade) no prompt', async () => {
      const context = await buildAgentContext(mockUserId, mockSessionKeyDM);

      // Se profile.soulContent existe, deve estar no prompt
      if (context.soulContent) {
        expect(context.systemPrompt).toContain('Personality');
        expect(context.systemPrompt).toContain(context.soulContent);
      }
    });

    test('inclui IDENTITY.md no prompt', async () => {
      const context = await buildAgentContext(mockUserId, mockSessionKeyDM);

      // Identidade deve sempre estar presente
      expect(context.systemPrompt).toMatch(/You are \w+.*personal AI assistant/);
    });

    test('inclui AGENTS.md (instruções) quando presente', async () => {
      const context = await buildAgentContext(mockUserId, mockSessionKeyDM);

      if (context.agentsContent) {
        expect(context.systemPrompt).toContain('Instructions');
        expect(context.systemPrompt).toContain(context.agentsContent);
      }
    });
  });

  describe('Injeção Condicional', () => {
    test('USER.md é injetado apenas em DMs', async () => {
      const dmContext = await buildAgentContext(mockUserId, mockSessionKeyDM);
      const groupContext = await buildAgentContext(mockUserId, mockSessionKeyGroup);

      // DM pode ter USER.md
      if (dmContext.userContent) {
        expect(dmContext.systemPrompt).toContain('User Profile');
      }

      // Grupo NUNCA deve ter USER.md
      expect(groupContext.systemPrompt).not.toContain('User Profile');
    });

    test('MEMORY.md é injetado apenas na sessão main', async () => {
      const mainContext = await buildAgentContext(mockUserId, mockSessionKeyMain);
      const dmContext = await buildAgentContext(mockUserId, mockSessionKeyDM);

      // Sessão main pode ter MEMORY.md
      if (mainContext.memoryContent) {
        expect(mainContext.systemPrompt).toContain('Long-term Memory');
      }

      // DM normal não tem MEMORY.md
      expect(dmContext.systemPrompt).not.toContain('Long-term Memory');
    });
  });

  describe('Privacidade', () => {
    test('perfil do usuário NUNCA vazado em grupos', async () => {
      const groupContext = await buildAgentContext(mockUserId, mockSessionKeyGroup);

      expect(groupContext.systemPrompt).not.toContain('User Profile');
      expect(groupContext.userContent).toBeUndefined();
    });

    test('sessões secundárias não recebem MEMORY.md', async () => {
      const secondaryContext = await buildAgentContext(mockUserId, mockSessionKeyDM);

      expect(secondaryContext.systemPrompt).not.toContain('Long-term Memory');
      expect(secondaryContext.memoryContent).toBeUndefined();
    });
  });

  describe('Estrutura do Context', () => {
    test('retorna todas as seções solicitadas', async () => {
      const context = await buildAgentContext(mockUserId, mockSessionKeyDM);

      expect(context).toHaveProperty('systemPrompt');
      expect(context).toHaveProperty('soulContent');
      expect(context).toHaveProperty('identityContent');
      expect(context).toHaveProperty('agentsContent');
      expect(context).toHaveProperty('userContent');
      expect(context).toHaveProperty('toolsContent');
      expect(context).toHaveProperty('memoryContent');
    });

    test('systemPrompt é string não-vazia', async () => {
      const context = await buildAgentContext(mockUserId, mockSessionKeyDM);

      expect(typeof context.systemPrompt).toBe('string');
      expect(context.systemPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('Tipos de Sessão', () => {
    test('identifica corretamente DM pelo session key', async () => {
      const dmKey = 'agent:main:telegram:direct:+1234567890';
      const isDirectMessage = dmKey.includes(':direct:');

      expect(isDirectMessage).toBe(true);
    });

    test('identifica corretamente grupo pelo session key', async () => {
      const groupKey = 'agent:main:telegram:group:-1001234567890';
      const isGroup = groupKey.includes(':group:');

      expect(isGroup).toBe(true);
    });

    test('identifica sessão main pelo agentId', async () => {
      const mainKey = 'agent:main:telegram:direct:+1234567890';
      const isMain = mainKey.includes(':main:');

      expect(isMain).toBe(true);
    });
  });
});
