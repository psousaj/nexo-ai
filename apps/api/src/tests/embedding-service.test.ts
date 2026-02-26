import { EmbeddingService } from '@/services/ai/embedding-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('EmbeddingService', () => {
	let service: EmbeddingService;
	let createMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetAllMocks();
		service = new EmbeddingService();
		createMock = vi.fn();
		(service as any).client = {
			embeddings: {
				create: createMock,
			},
		};
	});

	it('deve inicializar sem erro com env válido', () => {
		expect(service).toBeDefined();
	});

	describe('generateEmbedding', () => {
		it('deve gerar embedding com sucesso para texto válido', async () => {
			const mockEmbedding = [0.1, 0.2, 0.3];
			createMock.mockResolvedValueOnce({
				data: [{ embedding: mockEmbedding }],
			});

			const result = await service.generateEmbedding('Texto de teste');

			expect(result).toEqual(mockEmbedding);
			expect(createMock).toHaveBeenCalledWith({
				model: 'dynamic/embeddings',
				input: 'Texto de teste',
			});
		});

		it('deve truncar texto longo antes de enviar para a API', async () => {
			const longText = 'a'.repeat(3000);
			const expectedText = `${'a'.repeat(2000)}...`;

			createMock.mockResolvedValueOnce({
				data: [{ embedding: [0.1, 0.2] }],
			});

			await service.generateEmbedding(longText);

			expect(createMock).toHaveBeenCalledWith({
				model: 'dynamic/embeddings',
				input: expectedText,
			});
		});

		it('deve lançar erro para texto vazio', async () => {
			await expect(service.generateEmbedding('')).rejects.toThrow('Texto vazio - não pode gerar embedding');
			await expect(service.generateEmbedding('   ')).rejects.toThrow('Texto vazio - não pode gerar embedding');
		});

		it('deve lançar erro se a resposta tiver formato inválido', async () => {
			createMock.mockResolvedValueOnce({
				data: [],
			});

			await expect(service.generateEmbedding('teste')).rejects.toThrow('Formato de resposta inválido da API');
		});

		it('deve lançar erro se a API retornar um vetor de zeros', async () => {
			createMock.mockResolvedValueOnce({
				data: [{ embedding: [0, 0, 0] }],
			});

			await expect(service.generateEmbedding('teste')).rejects.toThrow('Embedding inválido: vetor de zeros retornado');
		});

		it('deve aplicar retry em erro 500 e concluir quando a próxima tentativa funcionar', async () => {
			createMock.mockRejectedValueOnce({ status: 500, message: 'Internal server error' }).mockResolvedValueOnce({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
			});

			const result = await service.generateEmbedding('texto com retry');

			expect(result).toEqual([0.1, 0.2, 0.3]);
			expect(createMock).toHaveBeenCalledTimes(2);
		});
	});
});
