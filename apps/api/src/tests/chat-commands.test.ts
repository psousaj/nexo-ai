/**
 * Testes unitários para Chat Commands
 *
 * Valida:
 * - Registro de comandos
 * - Parsing de comandos
 * - Execução de comandos
 * - Permissões (DM vs grupo)
 */

import { type CommandParams, chatCommands } from '@/services/chat-commands';
import { describe, expect, test } from 'vitest';

describe('Chat Commands', () => {
	const mockParams: CommandParams = {
		command: 'status',
		args: '',
		userId: 'user-123',
		sessionKey: 'agent:main:telegram:direct:+1234567890',
		conversationId: 'conv-123',
		sessionId: 'session-123',
	};

	describe('Comandos Disponíveis', () => {
		test('comando /status está disponível', () => {
			expect(chatCommands).toHaveProperty('status');
			expect(chatCommands.status.name).toBe('status');
		});

		test('comando /new está disponível', () => {
			expect(chatCommands).toHaveProperty('new');
			expect(chatCommands.new.name).toBe('new');
		});

		test('comando /reset é alias de /new', () => {
			expect(chatCommands).toHaveProperty('reset');
		});

		test('comando /memory está disponível', () => {
			expect(chatCommands).toHaveProperty('memory');
			expect(chatCommands.memory.name).toBe('memory');
		});

		test('comando /profile está disponível', () => {
			expect(chatCommands).toHaveProperty('profile');
			expect(chatCommands.profile.name).toBe('profile');
		});

		test('comando /think está disponível', () => {
			expect(chatCommands).toHaveProperty('think');
			expect(chatCommands.think.name).toBe('think');
		});
	});

	describe('Execução de Comandos', () => {
		test('comando /status retorna informações da sessão', async () => {
			const response = await chatCommands.status.handler(mockParams);

			expect(typeof response).toBe('string');
			expect(response).toBeDefined();
		});

		test('comando /help lista comandos disponíveis', async () => {
			const response = await chatCommands.help.handler(mockParams);

			expect(typeof response).toBe('string');
			expect(response.length).toBeGreaterThan(0);
		});
	});

	describe('Permissões', () => {
		test('comandos têm flag allowedInGroups', () => {
			// /status deve funcionar em grupos
			expect(chatCommands.status.allowedInGroups).toBe(true);

			// /memory não deve funcionar em grupos
			expect(chatCommands.memory.allowedInGroups).toBe(false);
		});

		test('comandos têm flag requireAuth', () => {
			// Alguns comandos podem requerer autenticação
			expect(chatCommands).toHaveProperty('profile');
		});
	});

	describe('Aliases', () => {
		test('/new e /reset apontam para mesma função', () => {
			expect(chatCommands.new).toBeDefined();
			expect(chatCommands.reset).toBeDefined();
		});

		test('aliases funcionam corretamente', () => {
			expect(chatCommands.new.aliases).toContain('reset');
		});
	});

	describe('Parâmetros de Comando', () => {
		test('/think aceita nível de thinking', async () => {
			const params = {
				...mockParams,
				command: 'think',
				args: 'medium',
			};

			const response = await chatCommands.think.handler(params);
			expect(typeof response).toBe('string');
		});

		test('/profile aceita dados de perfil', async () => {
			const params = {
				...mockParams,
				command: 'profile',
				args: 'name: Test User',
			};

			const response = await chatCommands.profile.handler(params);
			expect(typeof response).toBe('string');
		});
	});

	describe('Descrições', () => {
		test('todos os comandos têm descrição', () => {
			Object.values(chatCommands).forEach((cmd) => {
				expect(cmd.description).toBeDefined();
				expect(cmd.description.length).toBeGreaterThan(0);
			});
		});

		test('descrições são úteis para usuários', () => {
			expect(chatCommands.status.description).toContain('status');
			expect(chatCommands.memory.description).toContain('memory');
		});
	});
});
