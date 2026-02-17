import { env } from '@/config/env';
import { EmbeddingService } from '@/services/ai/embedding-service';
import OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock do OpenAI SDK
vi.mock('openai', () => {
	const OpenAI = vi.fn();
	OpenAI.prototype.embeddings = {
		create: vi.fn(),
	};
	return { default: OpenAI };
});

describe('EmbeddingService', () => {
	let service: EmbeddingService;
	let mockOpenAIInstance: any;

	beforeEach(() => {
		vi.resetAllMocks();
		service = new EmbeddingService();
		mockOpenAIInstance = (OpenAI as any).mock.instances[0];
	});

	it('deve lançar erro se as credenciais do Cloudflare não estiverem configuradas', () => {
		const originalAccountId = env.CLOUDFLARE_ACCOUNT_ID;
		const originalApiToken = env.CLOUDFLARE_API_TOKEN;
		const originalGatewayId = env.CLOUDFLARE_GATEWAY_ID;

		// @ts-ignore
		env.CLOUDFLARE_ACCOUNT_ID = undefined;
		// @ts-ignore
		env.CLOUDFLARE_API_TOKEN = undefined;
		// @ts-ignore
		env.CLOUDFLARE_GATEWAY_ID = undefined;

		expect(() => new EmbeddingService()).toThrow('Cloudflare credentials não configuradas para Embeddings');

		// @ts-ignore
		env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
		// @ts-ignore
		env.CLOUDFLARE_API_TOKEN = originalApiToken;
		// @ts-ignore
		env.CLOUDFLARE_GATEWAY_ID = originalGatewayId;
	});

	it('deve inicializar o cliente OpenAI com a baseURL do AI Gateway compat', () => {
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: expect.stringContaining('gateway.ai.cloudflare.com'),
			}),
		);
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: expect.stringContaining('/compat'),
			}),
		);
	});

	describe('generateEmbedding', () => {
		it('deve gerar embedding com sucesso para texto válido', async () => {
			const mockEmbedding = [0.1, 0.2, 0.3];
			mockOpenAIInstance.embeddings.create.mockResolvedValueOnce({
				data: [{ embedding: mockEmbedding }],
			});

			const result = await service.generateEmbedding('Texto de teste');

			expect(result).toEqual(mockEmbedding);
			expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
				model: 'dynamic/embeddings',
				input: 'Texto de teste',
			});
		});

		it('deve truncar texto longo antes de enviar para a API', async () => {
			const longText = 'a'.repeat(3000);
			const expectedText = `${'a'.repeat(2000)}...`;

			mockOpenAIInstance.embeddings.create.mockResolvedValueOnce({
				data: [{ embedding: [0.1, 0.2] }],
			});

			await service.generateEmbedding(longText);

			expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
				model: 'dynamic/embeddings',
				input: expectedText,
			});
		});

		it('deve lançar erro para texto vazio', async () => {
			await expect(service.generateEmbedding('')).rejects.toThrow('Texto vazio - não pode gerar embedding');
			await expect(service.generateEmbedding('   ')).rejects.toThrow('Texto vazio - não pode gerar embedding');
		});

		it('deve lançar erro se a resposta tiver formato inválido', async () => {
			mockOpenAIInstance.embeddings.create.mockResolvedValueOnce({
				data: [],
			});

			await expect(service.generateEmbedding('teste')).rejects.toThrow('Formato de resposta inválido da API');
		});

		it('deve lançar erro se a API retornar um vetor de zeros', async () => {
			mockOpenAIInstance.embeddings.create.mockResolvedValueOnce({
				data: [{ embedding: [0, 0, 0] }],
			});

			await expect(service.generateEmbedding('teste')).rejects.toThrow('Embedding inválido: vetor de zeros retornado');
		});
	});
});
