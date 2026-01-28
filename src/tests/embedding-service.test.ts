import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '@/services/ai/embedding-service';
import { env } from '@/config/env';

// Mock do fetch global
global.fetch = vi.fn();

describe('EmbeddingService', () => {
	let service: EmbeddingService;

	beforeEach(() => {
		vi.resetAllMocks();
		service = new EmbeddingService();
	});

	it('deve lançar erro se as credenciais do Cloudflare não estiverem configuradas', () => {
		// Temporariamente sobrescrever as envs para falhar o constructor
		const originalAccountId = env.CLOUDFLARE_ACCOUNT_ID;
		const originalApiToken = env.CLOUDFLARE_API_TOKEN;

		// @ts-ignore - Modificando env para teste
		env.CLOUDFLARE_ACCOUNT_ID = undefined;
		// @ts-ignore
		env.CLOUDFLARE_API_TOKEN = undefined;

		expect(() => new EmbeddingService()).toThrow('Cloudflare credentials não configuradas para Embeddings');

		// Restaurar
		// @ts-ignore
		env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
		// @ts-ignore
		env.CLOUDFLARE_API_TOKEN = originalApiToken;
	});

	describe('generateEmbedding', () => {
		it('deve gerar embedding com sucesso para texto válido', async () => {
			const mockEmbedding = [0.1, 0.2, 0.3];
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					result: {
						data: [mockEmbedding],
					},
				}),
			});

			const result = await service.generateEmbedding('Texto de teste');

			expect(result).toEqual(mockEmbedding);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining(env.CLOUDFLARE_ACCOUNT_ID!),
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
					}),
					body: JSON.stringify({ text: 'Texto de teste' }),
				}),
			);
		});

		it('deve truncar texto longo antes de enviar para a API', async () => {
			const longText = 'a'.repeat(3000);
			const expectedText = 'a'.repeat(2000) + '...';

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					result: {
						data: [[0.1, 0.2]],
					},
				}),
			});

			await service.generateEmbedding(longText);

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: JSON.stringify({ text: expectedText }),
				}),
			);
		});

		it('deve lançar erro para texto vazio', async () => {
			await expect(service.generateEmbedding('')).rejects.toThrow('Texto vazio - não pode gerar embedding');
			await expect(service.generateEmbedding('   ')).rejects.toThrow('Texto vazio - não pode gerar embedding');
		});

		it('deve lançar erro se a API do Cloudflare responder com erro', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: async () => 'Internal Server Error',
			});

			await expect(service.generateEmbedding('teste')).rejects.toThrow('Cloudflare API error (500): Internal Server Error');
		});

		it('deve lançar erro se a resposta tiver formato inválido', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					result: {}, // Faltando data
				}),
			});

			await expect(service.generateEmbedding('teste')).rejects.toThrow('Formato de resposta inválido da API Cloudflare');
		});

		it('deve lançar erro se a API retornar um vetor de zeros', async () => {
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					result: {
						data: [[0, 0, 0]],
					},
				}),
			});

			await expect(service.generateEmbedding('teste')).rejects.toThrow('Embedding inválido: vetor de zeros retornado');
		});
	});
});
