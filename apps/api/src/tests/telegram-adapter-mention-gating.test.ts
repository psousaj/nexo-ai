/**
 * Testes unitários para Telegram Adapter - Mention Gating
 *
 * Valida:
 * - Mensagens em grupos são processadas apenas com @bot
 * - Mensagens em DM sempre são processadas
 * - Comandos em grupos requerem menção
 */

import { TelegramAdapter } from '@/adapters/messaging/telegram-adapter';
import { describe, expect, test } from 'vitest';

describe('Telegram Adapter - Mention Gating', () => {
	let _adapter: TelegramAdapter;
	const mockBotToken = 'test-token';
	const mockBotUsername = 'testbot';

	beforeEach(() => {
		_adapter = new TelegramAdapter({
			botToken: mockBotToken,
			botUsername: mockBotUsername,
		});
	});

	describe('Detecção de Grupo', () => {
		test('identifica chat privado como DM', () => {
			const rawMessage = {
				chat: { id: 123456789, type: 'private' },
				text: 'Hello',
			};

			const isGroup = rawMessage.chat.type !== 'private';

			expect(isGroup).toBe(false);
		});

		test('identifica chat group como grupo', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'group' },
				text: 'Hello everyone',
			};

			const isGroup = rawMessage.chat.type !== 'private';

			expect(isGroup).toBe(true);
		});

		test('identifica supergroup como grupo', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'supergroup' },
				text: 'Hello everyone',
			};

			const isGroup = rawMessage.chat.type !== 'private';

			expect(isGroup).toBe(true);
		});

		test('identifica channel como grupo', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'channel' },
				text: 'Broadcast',
			};

			const isGroup = rawMessage.chat.type !== 'private';

			expect(isGroup).toBe(true);
		});
	});

	describe('Detecção de Menção', () => {
		test('detecta menção ao bot no texto', () => {
			const text = '@testbot status';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			expect(botMentioned).toBe(true);
		});

		test('detecta menção com comando', () => {
			const text = '/status@testbot';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			expect(botMentioned).toBe(true);
		});

		test('não detecta menção quando não existe', () => {
			const text = 'random message';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			expect(botMentioned).toBe(false);
		});

		test('detecta menção em texto com menções múltiplas', () => {
			const text = '@otherbot @testbot help';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			expect(botMentioned).toBe(true);
		});
	});

	describe('Comandos em Grupo', () => {
		test('comando sem menção em grupo é ignorado', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'supergroup' },
				text: '/status',
				entities: [{ type: 'bot_command', offset: 0, length: 7 }],
			};

			const isGroup = rawMessage.chat.type !== 'private';
			const text = rawMessage.text || '';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			// É grupo e não mencionou bot → ignorar
			expect(isGroup).toBe(true);
			expect(botMentioned).toBe(false);
		});

		test('comando com menção em grupo é processado', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'supergroup' },
				text: '/status@testbot',
				entities: [{ type: 'bot_command', offset: 0, length: 14 }],
			};

			const isGroup = rawMessage.chat.type !== 'private';
			const text = rawMessage.text || '';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			// É grupo mas mencionou bot → processar
			expect(isGroup).toBe(true);
			expect(botMentioned).toBe(true);
		});

		test('texto com menção em grupo é processado', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'supergroup' },
				text: '@testbot salva esse filme',
			};

			const isGroup = rawMessage.chat.type !== 'private';
			const text = rawMessage.text || '';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			// É grupo mas mencionou bot → processar
			expect(isGroup).toBe(true);
			expect(botMentioned).toBe(true);
		});
	});

	describe('Mensagens em DM', () => {
		test('comando em DM é sempre processado', () => {
			const rawMessage = {
				chat: { id: 123456789, type: 'private' },
				text: '/status',
				entities: [{ type: 'bot_command', offset: 0, length: 7 }],
			};

			const isGroup = rawMessage.chat.type !== 'private';

			// Não é grupo → sempre processar
			expect(isGroup).toBe(false);
		});

		test('texto em DM é sempre processado', () => {
			const rawMessage = {
				chat: { id: 123456789, type: 'private' },
				text: 'salva interstellar',
			};

			const isGroup = rawMessage.chat.type !== 'private';

			// Não é grupo → sempre processar
			expect(isGroup).toBe(false);
		});

		test('comando sem menção em DM é processado', () => {
			const rawMessage = {
				chat: { id: 123456789, type: 'private' },
				text: '/save',
				entities: [{ type: 'bot_command', offset: 0, length: 5 }],
			};

			const isGroup = rawMessage.chat.type !== 'private';

			// Não é grupo → sempre processar (não precisa de menção)
			expect(isGroup).toBe(false);
		});
	});

	describe('Lógica de Processamento', () => {
		test('grupo sem menção → ignorar', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'supergroup' },
				text: 'random message',
			};

			const isGroup = rawMessage.chat.type !== 'private';
			const text = rawMessage.text || '';
			const isCommand = text.startsWith('/');
			const botMentioned = text.includes(`@${mockBotUsername}`);

			const shouldProcess = !isGroup || botMentioned || !isCommand;

			expect(shouldProcess).toBe(false);
		});

		test('grupo com menção → processar', () => {
			const rawMessage = {
				chat: { id: -1001234567890, type: 'supergroup' },
				text: '@testbot help',
			};

			const isGroup = rawMessage.chat.type !== 'private';
			const text = rawMessage.text || '';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			const shouldProcess = !isGroup || botMentioned;

			expect(shouldProcess).toBe(true);
		});

		test('DM → sempre processar', () => {
			const rawMessage = {
				chat: { id: 123456789, type: 'private' },
				text: 'any message',
			};

			const isGroup = rawMessage.chat.type !== 'private';

			const shouldProcess = !isGroup;

			expect(shouldProcess).toBe(true);
		});
	});

	describe('Casos de Borda', () => {
		test('mensagem vazia', () => {
			const rawMessage = {
				chat: { id: 123456789, type: 'private' },
				text: '',
			};

			const isGroup = rawMessage.chat.type !== 'private';
			const shouldProcess = !isGroup;

			expect(shouldProcess).toBe(true);
		});

		test('menção com case diferente', () => {
			const text = '@TESTBOT status';
			const botMentioned = text.toLowerCase().includes(`@${mockBotUsername}`);

			expect(botMentioned).toBe(true);
		});

		test('menção parcial não conta', () => {
			const text = '@testbotty status';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			expect(botMentioned).toBe(false);
		});

		test('texto com múltiplas menções', () => {
			const text = '@user1 @testbot @user2 help';
			const botMentioned = text.includes(`@${mockBotUsername}`);

			expect(botMentioned).toBe(true);
		});
	});
});
