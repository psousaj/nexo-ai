/**
 * Voice Pipeline Integration Tests (NEX-19)
 *
 * Validates:
 * - EdgeTTSService synthesis (mocked HTTP)
 * - sendVoice in Telegram, Evolution, Discord adapters
 * - adapter-output-dispatcher send_voice case
 * - dispatchOutgoingVoice in outgoing-dispatcher
 * - /voice command toggles voiceMode
 */
import type { MessagingProvider } from '@/adapters/messaging/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Shared logger mock ──────────────────────────────────────────────────────

const mockPinoLogger = {
	info: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	child: vi.fn(() => mockPinoLogger),
};

const mockLoggers = {
	webhook: mockPinoLogger,
	ai: mockPinoLogger,
	discord: mockPinoLogger,
	db: mockPinoLogger,
	app: mockPinoLogger,
	nlp: mockPinoLogger,
	cloudflare: mockPinoLogger,
	gemini: mockPinoLogger,
	enrichment: mockPinoLogger,
	cache: mockPinoLogger,
	retry: mockPinoLogger,
	queue: mockPinoLogger,
	tools: mockPinoLogger,
	dateParser: mockPinoLogger,
	scheduler: mockPinoLogger,
	integrations: mockPinoLogger,
	context: mockPinoLogger,
	session: mockPinoLogger,
	memory: mockPinoLogger,
	api: mockPinoLogger,
};

vi.mock('@/utils/logger', () => ({
	logger: mockPinoLogger,
	loggers: mockLoggers,
}));

vi.mock('@nexo/otel/tracing', () => ({
	startSpan: (_name: string, fn: any) => fn({}),
	setAttributes: vi.fn(),
	recordException: vi.fn(),
}));

vi.mock('@/config/env', () => ({
	env: {
		TELEGRAM_BOT_TOKEN: 'test-token',
		TELEGRAM_BASE_URL: 'https://api.telegram.org',
		EVOLUTION_WEBHOOK_SECRET: 'test-secret',
		EVOLUTION_INSTANCE_NAME: 'test-instance',
		MULTIMODAL_AUDIO: true,
		EDGE_TTS_VOICE: 'pt-BR-FranciscaNeural',
		PROVIDER_SPLIT: false,
	},
}));

vi.mock('@/db', () => ({
	db: {
		query: {
			conversations: {
				findFirst: vi.fn(),
			},
			agentSessions: {
				findFirst: vi.fn().mockResolvedValue(null),
			},
			users: {
				findFirst: vi.fn().mockResolvedValue(null),
			},
		},
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
	},
}));

vi.mock('@/db/schema', () => ({
	conversations: { id: 'id' },
	agentSessions: {},
	users: {},
}));

vi.mock('@/services/session-service', () => ({
	buildSessionKey: vi.fn(() => 'telegram:+1234567890'),
	parseSessionKey: vi.fn(),
}));

vi.mock('@/services/conversation-service', () => ({
	conversationService: {
		updateState: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@/services/onboarding-service', () => ({
	onboardingService: {
		incrementInteractionCount: vi.fn(),
	},
}));

vi.mock('@/services/context-builder', () => ({
	getAgentProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/memory-search', () => ({
	searchMemory: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/sentry', () => ({
	setSentryContext: vi.fn(),
	captureException: vi.fn(),
}));

vi.mock('@/services/evolution-service', () => ({
	evolutionService: {
		sendText: vi.fn(),
		sendList: vi.fn(),
		sendMediaImage: vi.fn(),
		sendMediaAudio: vi.fn(),
		request: vi.fn(),
	},
}));

// ── Edge TTS Service Tests ──────────────────────────────────────────────────

describe('EdgeTTSService', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('synthesizes audio and returns Buffer + mimeType + filename', async () => {
		const fakeAudio = Buffer.alloc(200, 0xaa);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: async () =>
				fakeAudio.buffer.slice(fakeAudio.byteOffset, fakeAudio.byteOffset + fakeAudio.byteLength),
		});

		const { EdgeTTSService } = await import('@/services/tts/edge-tts.service');
		const service = new EdgeTTSService();
		const result = await service.synthesize('Olá, mundo!');

		expect(result.mimeType).toBe('audio/ogg; codecs=opus');
		expect(result.filename).toBe('voice.ogg');
		expect(result.audioBuffer.length).toBeGreaterThan(0);
	});

	it('throws on empty text', async () => {
		const { EdgeTTSService } = await import('@/services/tts/edge-tts.service');
		const service = new EdgeTTSService();
		await expect(service.synthesize('')).rejects.toThrow('Text cannot be empty');
	});

	it('uses mp3 format when specified', async () => {
		const fakeAudio = Buffer.alloc(200, 0xbb);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: async () =>
				fakeAudio.buffer.slice(fakeAudio.byteOffset, fakeAudio.byteOffset + fakeAudio.byteLength),
		});

		const { EdgeTTSService } = await import('@/services/tts/edge-tts.service');
		const service = new EdgeTTSService();
		const result = await service.synthesize('Teste MP3', { outputFormat: 'mp3' });

		expect(result.mimeType).toBe('audio/mpeg');
		expect(result.filename).toBe('voice.mp3');
	});

	it('throws on API error', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
			text: async () => 'Forbidden',
		});

		const { EdgeTTSService } = await import('@/services/tts/edge-tts.service');
		const service = new EdgeTTSService();
		await expect(service.synthesize('test')).rejects.toThrow('Edge TTS API error');
	});

	it('throws on empty audio response', async () => {
		const tinyAudio = Buffer.alloc(10, 0x00);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: async () =>
				tinyAudio.buffer.slice(tinyAudio.byteOffset, tinyAudio.byteOffset + tinyAudio.byteLength),
		});

		const { EdgeTTSService } = await import('@/services/tts/edge-tts.service');
		const service = new EdgeTTSService();
		await expect(service.synthesize('test')).rejects.toThrow('empty or invalid audio');
	});
});

// ── TelegramAdapter sendVoice Tests ─────────────────────────────────────────

describe('TelegramAdapter.sendVoice', () => {
	let adapter: any;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(async () => {
		originalFetch = globalThis.fetch;
		const { TelegramAdapter } = await import('@/adapters/messaging/telegram-adapter');
		adapter = new TelegramAdapter();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('sends voice via FormData to sendVoice API endpoint', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true }),
		});
		globalThis.fetch = mockFetch;

		const audioBuffer = Buffer.from('fake-opus-data');
		await adapter.sendVoice('123456', audioBuffer, 'audio/ogg; codecs=opus', 'voice.ogg');

		expect(mockFetch).toHaveBeenCalled();
		const call = mockFetch.mock.calls[0];
		expect(call[0]).toContain('/sendVoice');
		expect(call[1].method).toBe('POST');
		expect(call[1].body).toBeInstanceOf(FormData);
	});
});

// ── EvolutionAdapter sendVoice Tests ─────────────────────────────────────────

describe('EvolutionAdapter.sendVoice', () => {
	let adapter: any;

	beforeEach(async () => {
		vi.resetModules();
		const { EvolutionAdapter } = await import('@/adapters/messaging/evolution-adapter');
		adapter = new EvolutionAdapter();
	});

	it('calls evolutionService.sendMediaAudio with base64-encoded audio', async () => {
		const { evolutionService } = await import('@/services/evolution-service');
		const sendMediaAudioSpy = vi.spyOn(evolutionService, 'sendMediaAudio').mockResolvedValue(undefined);
		const audioBuffer = Buffer.from('fake-audio-bytes');

		await adapter.sendVoice('5511999999999', audioBuffer, 'audio/ogg; codecs=opus', 'voice.ogg');

		expect(sendMediaAudioSpy).toHaveBeenCalledWith(
			'5511999999999',
			audioBuffer.toString('base64'),
			'audio/ogg; codecs=opus',
			'voice.ogg',
		);
		sendMediaAudioSpy.mockRestore();
	});

	it('uses default filename and mimeType when not provided', async () => {
		const { evolutionService } = await import('@/services/evolution-service');
		const sendMediaAudioSpy = vi.spyOn(evolutionService, 'sendMediaAudio').mockResolvedValue(undefined);
		const audioBuffer = Buffer.from('fake-audio-bytes');

		await adapter.sendVoice('5511999999999', audioBuffer, 'audio/ogg; codecs=opus');

		expect(sendMediaAudioSpy).toHaveBeenCalledWith(
			'5511999999999',
			audioBuffer.toString('base64'),
			'audio/ogg; codecs=opus',
			'voice.ogg',
		);
		sendMediaAudioSpy.mockRestore();
	});
});

// ── adapter-output-dispatcher send_voice Tests ───────────────────────────────

describe('adapter-output-dispatcher send_voice', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('calls provider.sendVoice when available', async () => {
		const mockSendVoice = vi.fn().mockResolvedValue(undefined);
		const mockProvider = {
			sendVoice: mockSendVoice,
			sendMessage: vi.fn(),
			getProviderName: () => 'telegram',
		} as unknown as MessagingProvider;

		const { dispatchAdapterOutputJob } = await import('@/services/adapter-output-dispatcher');

		const audioBuffer = Buffer.from('voice-data');
		await dispatchAdapterOutputJob(
			{
				version: 'v1',
				eventType: 'message.outbound',
				channel: 'telegram',
				eventId: 'evt-1',
				idempotencyKey: 'idem-1',
				occurredAt: new Date().toISOString(),
				payload: {
					providerName: 'telegram',
					externalId: '123',
					deliveryMethod: 'send_voice',
					voiceBuffer: audioBuffer,
					voiceMimeType: 'audio/ogg; codecs=opus',
					voiceFilename: 'voice.ogg',
				},
			},
			async () => mockProvider,
		);

		expect(mockSendVoice).toHaveBeenCalledWith('123', audioBuffer, 'audio/ogg; codecs=opus', 'voice.ogg');
	});

	it('falls back to sendMessage when sendVoice is not available', async () => {
		const mockSendMessage = vi.fn().mockResolvedValue(undefined);
		const mockProvider = {
			sendMessage: mockSendMessage,
			getProviderName: () => 'evolution',
		} as unknown as MessagingProvider;

		const { dispatchAdapterOutputJob } = await import('@/services/adapter-output-dispatcher');

		await dispatchAdapterOutputJob(
			{
				version: 'v1',
				eventType: 'message.outbound',
				channel: 'whatsapp',
				eventId: 'evt-2',
				idempotencyKey: 'idem-2',
				occurredAt: new Date().toISOString(),
				payload: {
					providerName: 'whatsapp',
					externalId: '456',
					deliveryMethod: 'send_voice',
					voiceBuffer: Buffer.from('voice-data'),
					voiceMimeType: 'audio/ogg',
					voiceFilename: 'voice.ogg',
					text: 'fallback text',
				},
			},
			async () => mockProvider,
		);

		expect(mockSendMessage).toHaveBeenCalledWith('456', 'fallback text', undefined);
	});

	it('throws when voiceBuffer is missing', async () => {
		const mockProvider = {
			sendVoice: vi.fn(),
			sendMessage: vi.fn(),
			getProviderName: () => 'telegram',
		} as unknown as MessagingProvider;

		const { dispatchAdapterOutputJob } = await import('@/services/adapter-output-dispatcher');

		await expect(
			dispatchAdapterOutputJob(
				{
					version: 'v1',
					eventType: 'message.outbound',
					channel: 'telegram',
					eventId: 'evt-3',
					idempotencyKey: 'idem-3',
					occurredAt: new Date().toISOString(),
					payload: {
						providerName: 'telegram',
						externalId: '789',
						deliveryMethod: 'send_voice',
					},
				},
				async () => mockProvider,
			),
		).rejects.toThrow('voiceBuffer');
	});
});

// ── dispatchOutgoingVoice Tests ──────────────────────────────────────────────

describe('dispatchOutgoingVoice', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('calls provider.sendVoice directly when split dispatch is off', async () => {
		const mockSendVoice = vi.fn().mockResolvedValue(undefined);
		const mockProvider = {
			sendVoice: mockSendVoice,
			sendMessage: vi.fn(),
			getProviderName: () => 'telegram',
		} as unknown as MessagingProvider;

		const { dispatchOutgoingVoice } = await import('@/services/outgoing-dispatcher.service');

		const audioBuffer = Buffer.from('audio-bytes');
		await dispatchOutgoingVoice(
			{
				provider: mockProvider,
				providerName: 'telegram',
				externalId: '123',
			},
			audioBuffer,
			'audio/ogg; codecs=opus',
			'voice.ogg',
		);

		expect(mockSendVoice).toHaveBeenCalledWith('123', audioBuffer, 'audio/ogg; codecs=opus', 'voice.ogg');
	});

	it('falls back to sendMessage when sendVoice is not available', async () => {
		const mockSendMessage = vi.fn().mockResolvedValue(undefined);
		const mockProvider = {
			sendMessage: mockSendMessage,
			getProviderName: () => 'evolution',
		} as unknown as MessagingProvider;

		const { dispatchOutgoingVoice } = await import('@/services/outgoing-dispatcher.service');

		const audioBuffer = Buffer.from('audio-bytes');
		await dispatchOutgoingVoice(
			{
				provider: mockProvider,
				providerName: 'evolution',
				externalId: '456',
			},
			audioBuffer,
			'audio/mpeg',
		);

		expect(mockSendMessage).toHaveBeenCalledWith('456', '[voice message]');
	});
});

// ── /voice Command Tests ─────────────────────────────────────────────────────

describe('/voice command', () => {
	const mockUpdateState = vi.fn().mockResolvedValue(undefined);

	beforeEach(() => {
		vi.resetModules();
		mockUpdateState.mockClear();
	});

	it('voice command is registered with aliases', async () => {
		const { chatCommands } = await import('@/services/chat-commands');
		expect(chatCommands.voice).toBeDefined();
		expect(chatCommands.voice.name).toBe('voice');
		expect(chatCommands.voice.aliases).toContain('voz');
		expect(chatCommands.voice.aliases).toContain('audio');
		expect(chatCommands.voice.allowedInGroups).toBe(false);
	});

	it('toggles voiceMode on when currently off', async () => {
		const { chatCommands } = await import('@/services/chat-commands');
		const { conversationService } = await import('@/services/conversation-service');

		vi.spyOn(conversationService, 'updateState').mockImplementation(mockUpdateState);

		const { db: _db } = await import('@/db');
		const { eq: _eq } = await import('drizzle-orm');
		const { conversations: _conversations } = await import('@/db/schema');

		const mockConv = {
			id: 'conv-1',
			context: { voiceMode: false },
			state: 'idle',
		};
		vi.spyOn(db.query, 'conversations', 'get').mockReturnValue({
			findFirst: vi.fn().mockResolvedValue(mockConv),
		});

		const result = await chatCommands.voice.handler({
			userId: 'user-1',
			conversationId: 'conv-1',
			sessionKey: 'agent:main:telegram:direct:+1234',
			provider: 'telegram',
		});

		expect(result).toContain('ativado');
		expect(mockUpdateState).toHaveBeenCalledWith('conv-1', 'idle', expect.objectContaining({ voiceMode: true }));
	});

	it('toggles voiceMode off when already on', async () => {
		const { chatCommands } = await import('@/services/chat-commands');
		const { conversationService } = await import('@/services/conversation-service');

		vi.spyOn(conversationService, 'updateState').mockImplementation(mockUpdateState);

		const { db } = await import('@/db');
		const mockConv = {
			id: 'conv-1',
			context: { voiceMode: true },
			state: 'idle',
		};
		vi.spyOn(db.query, 'conversations', 'get').mockReturnValue({
			findFirst: vi.fn().mockResolvedValue(mockConv),
		});

		const result = await chatCommands.voice.handler({
			userId: 'user-1',
			conversationId: 'conv-1',
			sessionKey: 'agent:main:telegram:direct:+1234',
			provider: 'telegram',
		});

		expect(result).toContain('desativado');
		expect(mockUpdateState).toHaveBeenCalledWith('conv-1', 'idle', expect.objectContaining({ voiceMode: false }));
	});
});
