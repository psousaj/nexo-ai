import { AgentOrchestrator } from '@/services/agent-orchestrator';
import { getRandomMessage } from '@/services/message-analysis/constants/clarification-messages';
import { messageAnalyzer } from '@/services/message-analysis/message-analyzer.service';
import { describe, expect, test, vi } from 'vitest';

/**
 * Testes para o fluxo de clarificação (Anamnese N1/N2)
 *
 * Valida que mensagens longas/ambíguas disparam solicitação de clarificação
 * e que o sistema processa corretamente a resposta do usuário.
 */

// ─── Mocks necessários para o AgentOrchestrator e dependências ───────────────

vi.mock('@/db', () => ({
	db: {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([]),
				}),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
		query: {
			memoryItems: { findMany: vi.fn().mockResolvedValue([]) },
		},
	},
}));

vi.mock('@/adapters/messaging', () => ({
	getProvider: vi.fn().mockResolvedValue({
		sendMessage: vi.fn().mockResolvedValue(undefined),
	}),
	getProviderByName: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/tools/tool.service', () => ({
	toolService: {
		getSaveTools: vi.fn().mockResolvedValue([
			{ name: 'save_note', label: 'Nota', icon: '📝' },
			{ name: 'save_movie', label: 'Filme', icon: '🎬' },
			{ name: 'save_tv_show', label: 'Série', icon: '📺' },
			{ name: 'save_link', label: 'Link', icon: '🔗' },
		]),
		getEnabledTools: vi.fn().mockResolvedValue([]),
		canUseTool: vi.fn().mockResolvedValue(true),
	},
}));

vi.mock('@/services/tools', () => ({
	executeTool: vi.fn().mockResolvedValue({ success: true, message: 'ok', data: null }),
}));

vi.mock('@/services/conversation-service', () => ({
	conversationService: {
		findOrCreateConversation: vi.fn().mockResolvedValue({
			conversation: {
				id: 'test-conv-456',
				userId: 'test-user-123',
				state: 'awaiting_context',
				context: {
					pendingClarification: {
						originalMessage: 'mensagem longa aqui',
						detectedType: null,
						clarificationOptions: [],
					},
				},
			},
			user: { id: 'test-user-123', assistantName: 'NEXO' },
		}),
		getHistory: vi.fn().mockResolvedValue([]),
		updateState: vi.fn().mockResolvedValue(undefined),
		addMessage: vi.fn().mockResolvedValue(undefined),
		handleAmbiguousMessage: vi.fn().mockResolvedValue(false),
	},
}));

vi.mock('@/services/user-service', () => ({
	userService: {
		getUserById: vi.fn().mockResolvedValue({ id: 'test-user-123', assistantName: 'NEXO' }),
	},
}));

vi.mock('@/services/ai', () => ({
	llmService: {
		callLLM: vi.fn().mockResolvedValue({
			message:
				'{"schema_version":"2.0","action":"RESPOND","reasoning_intent":{"category":"conversation","confidence":0.9,"trigger":"natural_language"},"response":{"text":"Por favor, escolha uma opção válida.","tone_profile":"neutral"}}',
			metadata: {},
		}),
	},
}));

vi.mock('@/utils/json-parser', () => ({
	parseAgentDecisionV2FromLLM: vi.fn().mockReturnValue({
		schema_version: '2.0',
		action: 'RESPOND',
		reasoning_intent: { category: 'conversation', confidence: 0.9, trigger: 'natural_language' },
		response: { text: 'Por favor, escolha uma opção válida.', tone_profile: 'neutral' },
		tool_call: null,
	}),
	isValidAgentResponse: vi.fn().mockReturnValue(true),
}));

vi.mock('@nexo/otel/tracing', () => ({
	startSpan: vi.fn(async (_name: string, fn: (span: unknown) => Promise<unknown>) => fn({})),
	setAttributes: vi.fn(),
	recordException: vi.fn(),
}));

vi.mock('@/services/service-instrumentation', () => ({
	instrumentService: (_name: string, instance: unknown) => instance,
}));

vi.mock('@/services/queue-service', () => ({
	scheduleConversationClose: vi.fn(),
	cancelConversationClose: vi.fn(),
}));

vi.mock('@/config/pivot-feature-flags', () => ({
	getPivotFeatureFlags: vi.fn().mockResolvedValue({ TOOL_SCHEMA_V2: true }),
}));

vi.mock('@sentry/node', () => ({
	startSpan: vi.fn(async (_options: unknown, fn: (span: unknown) => Promise<unknown>) => fn({})),
	captureException: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────

const mockConversation = {
	id: 'test-conv-456',
	userId: 'test-user-123',
	state: 'awaiting_context' as const,
	context: {
		pendingClarification: {
			originalMessage: 'mensagem longa aqui',
			detectedType: null,
			clarificationOptions: [],
		},
	},
};

const mockContext = {
	userId: 'test-user-123',
	conversationId: 'test-conv-456',
	externalId: 'test-external-123',
	provider: 'telegram' as const,
};

describe('Clarification Flow (N1/N2)', () => {
	// ── Parte 1: Deteção de ambiguidade (checkAmbiguity é pura, sem DB) ──────

	test('deve detectar mensagem longa sem verbo de ação como ambígua', () => {
		const longMessage =
			'Salvar info tmdb como vector na base de dados ao salvar e ao buscar enrichment para seleção do usuário para referências como "o da zebra com o leão na ilha" para a query "madagascar"';

		const result = messageAnalyzer.checkAmbiguity(longMessage);

		expect(result.isAmbiguous).toBe(true);
	});

	test('não deve considerar mensagem com verbo de ação claro como ambígua', () => {
		const actionMessage = 'salva inception';

		const result = messageAnalyzer.checkAmbiguity(actionMessage);

		expect(result.isAmbiguous).toBe(false);
	});

	test('deve detectar mensagem curta sem verbo como ambígua', () => {
		const shortMessage = 'dj khaled';

		const result = messageAnalyzer.checkAmbiguity(shortMessage);

		expect(result.isAmbiguous).toBe(true);
	});

	test('não deve considerar mensagem curta com contexto como ambígua', () => {
		const shortMessage = 'busca filmes de terror com zumbis';

		const result = messageAnalyzer.checkAmbiguity(shortMessage);

		expect(result.isAmbiguous).toBe(false);
	});

	// ── Parte 2: Resposta de clarificação via handleClarificationResponse ────

	test('deve processar escolha "1" (nota) corretamente', async () => {
		const orchestrator = new AgentOrchestrator();

		const response = await (orchestrator as any).handleClarificationResponse(
			{ ...mockContext, message: '1' },
			structuredClone(mockConversation),
		);

		// choice '1' → save_note → state torna-se 'idle', nota salva
		expect(response.state).toBe('idle');
		expect(response.message).toBeTruthy();
	});

	test('deve processar escolha "5" (cancelar) corretamente', async () => {
		const orchestrator = new AgentOrchestrator();

		// 4 save tools → cancelIndex = 5
		const response = await (orchestrator as any).handleClarificationResponse(
			{ ...mockContext, message: '5' },
			structuredClone(mockConversation),
		);

		expect(response.state).toBe('idle');
	});

	test('deve tratar escolha inválida (não numérica) sem crash', async () => {
		const orchestrator = new AgentOrchestrator();

		// Mock NLP para não detectar tipo
		vi.spyOn(messageAnalyzer, 'classifyIntent').mockRejectedValueOnce(new Error('NLP not available'));

		// Mock processMessage recursivo para retornar resposta controlada
		vi.spyOn(orchestrator, 'processMessage').mockResolvedValueOnce({
			message: 'Por favor, escolha uma opção válida.',
			state: 'awaiting_context',
		});

		const response = await (orchestrator as any).handleClarificationResponse(
			{ ...mockContext, message: 'abc' },
			structuredClone(mockConversation),
		);

		// Deve retornar alguma resposta sem crash
		expect(typeof response.message).toBe('string');
		expect(response.state).toBeDefined();
	});
});

describe('Message Templates', () => {
	test('getRandomMessage deve retornar uma string de um array de templates', () => {
		const templates = ['Teste {name} com {value}', 'Outro template'];
		const result = getRandomMessage(templates);

		expect(typeof result).toBe('string');
		expect(templates).toContain(result);
	});

	test('getRandomMessage deve retornar template sem substituição se não houver replacements', () => {
		const templates = ['Teste sem placeholder'];
		const result = getRandomMessage(templates);

		expect(result).toBe('Teste sem placeholder');
	});
});
