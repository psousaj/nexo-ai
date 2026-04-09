import { EvolutionAdapter } from '@nexo/api-core/adapters/messaging/evolution-adapter';
import { describe, expect, test } from 'vitest';

describe('Evolution Adapter', () => {
	const adapter = new EvolutionAdapter();

	test('parseIncomingMessage: ignora mensagens enviadas pelo próprio bot', () => {
		const payload = {
			event: 'MESSAGES_UPSERT',
			data: {
				key: {
					id: 'msg-1',
					remoteJid: '5511999999999@s.whatsapp.net',
					fromMe: true,
				},
				message: {
					conversation: 'mensagem interna',
				},
				messageTimestamp: 1730000000,
			},
		};

		const parsed = adapter.parseIncomingMessage(payload);
		expect(parsed).toBeNull();
	});

	test('parseIncomingMessage: parseia texto simples e metadados básicos', () => {
		const payload = {
			event: 'MESSAGES_UPSERT',
			data: {
				key: {
					id: 'msg-2',
					remoteJid: '5511999999999@s.whatsapp.net',
					fromMe: false,
				},
				pushName: 'Jose',
				message: {
					conversation: 'salva interestelar',
				},
				messageTimestamp: 1730000000,
			},
		};

		const parsed = adapter.parseIncomingMessage(payload);

		expect(parsed).not.toBeNull();
		expect(parsed?.messageId).toBe('msg-2');
		expect(parsed?.provider).toBe('whatsapp');
		expect(parsed?.text).toBe('salva interestelar');
		expect(parsed?.phoneNumber).toBe('5511999999999');
		expect(parsed?.metadata?.sourceApi).toBe('evolution');
		expect(parsed?.metadata?.messageType).toBe('text');
	});

	test('parseIncomingMessage: converte resposta numerada para callbackData', () => {
		const payload = {
			event: 'MESSAGES_UPSERT',
			data: {
				key: {
					id: 'msg-3',
					remoteJid: '5511888888888@s.whatsapp.net',
					fromMe: false,
				},
				message: {
					conversation: '2',
				},
				messageTimestamp: 1730000000,
			},
		};

		const parsed = adapter.parseIncomingMessage(payload);
		expect(parsed?.callbackData).toBe('select_1');
		expect(parsed?.metadata?.messageType).toBe('callback');
	});

	test('parseIncomingMessage: parseia mensagem de grupo com participante', () => {
		const payload = {
			event: 'MESSAGES_UPSERT',
			data: {
				key: {
					id: 'msg-4',
					remoteJid: '120363312345678901@g.us',
					participant: '5511777777777@s.whatsapp.net',
					fromMe: false,
				},
				message: {
					extendedTextMessage: {
						text: 'qual foi a ultima nota?',
					},
				},
				messageTimestamp: 1730000000,
			},
		};

		const parsed = adapter.parseIncomingMessage(payload);

		expect(parsed).not.toBeNull();
		expect(parsed?.metadata?.isGroupMessage).toBe(true);
		expect(parsed?.metadata?.groupId).toBe('120363312345678901@g.us');
		expect(parsed?.userId).toBe('5511777777777');
		expect(parsed?.phoneNumber).toBe('5511777777777');
	});
});
