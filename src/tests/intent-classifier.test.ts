/**
 * Testes unitários para Intent Classifier
 *
 * Valida que intenções são detectadas corretamente
 */

import { describe, test, expect } from 'vitest';
import { IntentClassifier } from '@/services/intent-classifier';

const classifier = new IntentClassifier();

describe('IntentClassifier', () => {
	describe('Confirmações', () => {
		test('detecta "sim"', async () => {
			const result = await classifier.classify('sim');
			expect(result.intent).toBe('confirm');
			expect(result.confidence).toBeGreaterThan(0.9);
		});

		test('detecta "ok"', async () => {
			const result = await classifier.classify('ok');
			expect(result.intent).toBe('confirm');
		});

		test('detecta números (seleção)', async () => {
			const result = await classifier.classify('1');
			expect(result.intent).toBe('confirm');
			expect(result.entities?.selection).toBe(1);
		});

		test('detecta "o primeiro"', async () => {
			const result = await classifier.classify('o primeiro');
			expect(result.intent).toBe('confirm');
			expect(result.entities?.selection).toBe(1);
		});

		test('detecta "a segunda"', async () => {
			const result = await classifier.classify('a segunda');
			expect(result.intent).toBe('confirm');
			expect(result.entities?.selection).toBe(2);
		});
	});

	describe('Negações', () => {
		test('detecta "não"', async () => {
			const result = await classifier.classify('não');
			expect(result.intent).toBe('deny');
		});

		test('detecta "cancela"', async () => {
			const result = await classifier.classify('cancela');
			expect(result.intent).toBe('deny');
		});

		test('detecta "deixa pra lá"', async () => {
			const result = await classifier.classify('deixa pra lá');
			expect(result.intent).toBe('deny');
		});
	});

	describe('Buscas', () => {
		test('detecta "o que eu salvei"', async () => {
			const result = await classifier.classify('o que eu salvei?');
			expect(result.intent).toBe('search_content');
		});

		test('detecta "mostra meus filmes"', async () => {
			const result = await classifier.classify('mostra meus filmes');
			expect(result.intent).toBe('search_content');
		});

		test('detecta "lista séries"', async () => {
			const result = await classifier.classify('lista séries');
			expect(result.intent).toBe('search_content');
		});

		test('extrai query de busca', async () => {
			const result = await classifier.classify('busca terror');
			expect(result.intent).toBe('search_content');
			expect(result.entities?.query).toBe('terror');
		});

		test('comandos genéricos retornam query undefined (listar tudo)', async () => {
			// "minha lista" deve listar TUDO, não buscar por "minha"
			const result1 = await classifier.classify('minha lista');
			expect(result1.intent).toBe('search_content');
			expect(result1.entities?.query).toBeUndefined();

			// "o que eu salvei" = listar tudo
			const result2 = await classifier.classify('o que eu salvei');
			expect(result2.intent).toBe('search_content');
			expect(result2.entities?.query).toBeUndefined();

			// "mostra" = listar tudo
			const result3 = await classifier.classify('mostra');
			expect(result3.intent).toBe('search_content');
			expect(result3.entities?.query).toBeUndefined();
		});

		test('comandos específicos extraem query', async () => {
			const result1 = await classifier.classify('mostra filmes de terror');
			expect(result1.intent).toBe('search_content');
			expect(result1.entities?.query).toBe('filmes de terror');

			const result2 = await classifier.classify('minha lista de séries');
			expect(result2.intent).toBe('search_content');
			expect(result2.entities?.query).toBe('de séries');
		});
	});

	describe('Pedidos de informação', () => {
		test('detecta "o que é"', async () => {
			const result = await classifier.classify('o que é clube da luta?');
			expect(result.intent).toBe('get_info');
		});

		test('detecta "quem é"', async () => {
			const result = await classifier.classify('quem é christopher nolan?');
			expect(result.intent).toBe('get_info');
		});

		test('detecta "me fala sobre"', async () => {
			const result = await classifier.classify('me fala sobre breaking bad');
			expect(result.intent).toBe('get_info');
		});

		test('extrai query de info', async () => {
			const result = await classifier.classify('o que é matrix');
			expect(result.entities?.query).toBe('matrix');
		});
	});

	describe('Salvar conteúdo', () => {
		test('detecta URL de vídeo', async () => {
			const result = await classifier.classify('https://youtube.com/watch?v=abc123');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.url).toContain('youtube.com');
		});

		test('detecta "salva" explícito', async () => {
			const result = await classifier.classify('salva clube da luta');
			expect(result.intent).toBe('save_content');
		});

		test('detecta "quero assistir"', async () => {
			const result = await classifier.classify('quero assistir breaking bad');
			expect(result.intent).toBe('save_content');
		});

		test('detecta "salva ai" como referência ao anterior', async () => {
			const result = await classifier.classify('salva ai por favor');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.refersToPrevious).toBe(true);
		});

		test('detecta "guarda isso"', async () => {
			const result = await classifier.classify('guarda isso');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.refersToPrevious).toBe(true);
		});

		test('detecta "anota ai"', async () => {
			const result = await classifier.classify('anota ai');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.refersToPrevious).toBe(true);
		});

		test('detecta menção a streaming', async () => {
			// Só "vi no netflix que tem avatar" não tem palavra-chave de save
			// E não tem menção explícita a filme/série, então deve ser unknown
			const result = await classifier.classify('vi no netflix que tem avatar, quero assistir');
			expect(result.intent).toBe('save_content');
		});

		test('detecta filme sem palavra-chave explícita', async () => {
			// "clube da luta" é título curto (<50 chars) + menciona filme implicitamente
			// MAS sem contexto, deve ser unknown - deixar LLM decidir
			const result = await classifier.classify('clube da luta');
			expect(result.intent).toBe('unknown');
		});

		test('detecta descrição longa como save_content', async () => {
			const result = await classifier.classify(
				'Aplicativo over screen que conecta no spotify e permite adicionar a musica atual a várias playlists',
			);
			expect(result.intent).toBe('save_content');
		});

		test('não confunde busca com descrição longa', async () => {
			const result = await classifier.classify('mostra');
			expect(result.intent).toBe('search_content');

			// Frase longa (>80 chars) com "aplicativo" deve ser save_content
			const result2 = await classifier.classify(
				'Aplicativo over screen que conecta no spotify e permite adicionar a musica atual a várias playlists',
			);
			expect(result2.intent).toBe('save_content');
		});
	});

	describe('Conversa casual', () => {
		test('detecta "oi"', async () => {
			const result = await classifier.classify('oi');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "olá"', async () => {
			const result = await classifier.classify('olá');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "bom dia"', async () => {
			const result = await classifier.classify('bom dia');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "obrigado"', async () => {
			const result = await classifier.classify('obrigado');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "tchau"', async () => {
			const result = await classifier.classify('tchau');
			expect(result.intent).toBe('casual_chat');
		});
	});

	describe('Casos desconhecidos', () => {
		test('mensagem ambígua retorna unknown', async () => {
			const result = await classifier.classify('talvez mais tarde');
			expect(result.intent).toBe('unknown');
			expect(result.confidence).toBeLessThan(0.7);
		});

		test('mensagem complexa retorna unknown', async () => {
			// Mensagem com dúvida ("estava pensando", "não sei bem") deve ser unknown
			// IMPORTANTE: hasQuestionWords() detecta "estava pensando", "não sei"
			const result = await classifier.classify(
				'eu estava pensando se você poderia me ajudar com algo relacionado a filmes mas não sei bem o quê',
			);
			expect(result.intent).toBe('unknown');
		});
	});

	describe('Deletar conteúdo', () => {
		test('detecta "deleta tudo"', async () => {
			const result = await classifier.classify('deleta tudo');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_all');
			expect(result.entities?.target).toBe('all');
		});

		test('detecta "apaga tudo"', async () => {
			const result = await classifier.classify('apaga tudo');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_all');
		});

		test('detecta "limpa minha lista"', async () => {
			const result = await classifier.classify('limpa tudo');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_all');
		});

		test('detecta "apaga o primeiro"', async () => {
			const result = await classifier.classify('apaga o primeiro');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(1);
			expect(result.entities?.target).toBe('selection');
		});

		test('detecta "remove 3"', async () => {
			const result = await classifier.classify('remove 3');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(3);
		});

		test('detecta "deleta clube da luta"', async () => {
			const result = await classifier.classify('deleta clube da luta');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_item');
			expect(result.entities?.query).toBe('clube da luta');
			expect(result.entities?.target).toBe('item');
		});

		test('detecta "exclui a nota 3"', async () => {
			const result = await classifier.classify('exclui a nota 3');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(3);
			expect(result.entities?.target).toBe('selection');
		});
	});

	describe('Actions determinísticas', () => {
		test('search retorna action: list_all quando sem query', async () => {
			const result = await classifier.classify('minha lista');
			expect(result.action).toBe('list_all');
		});

		test('search retorna action: search quando tem query', async () => {
			const result = await classifier.classify('mostra filmes de terror');
			expect(result.action).toBe('search');
		});

		test('save retorna action: save', async () => {
			const result = await classifier.classify('salva inception');
			expect(result.action).toBe('save');
		});

		test('save_previous retorna action: save_previous', async () => {
			const result = await classifier.classify('salva ai');
			expect(result.action).toBe('save_previous');
		});

		test('casual retorna action: greet ou thank', async () => {
			const result1 = await classifier.classify('oi');
			expect(result1.action).toBe('greet');

			const result2 = await classifier.classify('obrigado');
			expect(result2.action).toBe('thank');
		});
	});

	describe('Edge cases', () => {
		test('mensagem vazia retorna unknown', async () => {
			const result = await classifier.classify('');
			expect(result.intent).toBe('unknown');
		});

		test('apenas espaços retorna unknown', async () => {
			const result = await classifier.classify('   ');
			expect(result.intent).toBe('unknown');
		});

		test('case insensitive', async () => {
			const result1 = await classifier.classify('SIM');
			const result2 = await classifier.classify('sim');
			expect(result1.intent).toBe(result2.intent);
		});

		test('ignora pontuação', async () => {
			const result = await classifier.classify('sim!');
			expect(result.intent).toBe('confirm');
		});
	});

	describe('Confiança', () => {
		test('confirmações têm alta confiança', async () => {
			const result = await classifier.classify('sim');
			expect(result.confidence).toBeGreaterThan(0.9);
		});

		test('buscas têm confiança média-alta', async () => {
			const result = await classifier.classify('o que eu salvei');
			expect(result.confidence).toBeGreaterThan(0.85);
		});

		test('unknown tem baixa confiança', async () => {
			const result = await classifier.classify('mensagem aleatória sem sentido');
			expect(result.confidence).toBeLessThan(0.6);
		});
	});

	describe('Extração de entidades', () => {
		test('extrai seleção numérica', async () => {
			const tests = [
				{ msg: '1', expected: 1 },
				{ msg: '2', expected: 2 },
				{ msg: 'o primeiro', expected: 1 },
				{ msg: 'a segunda', expected: 2 },
				{ msg: 'o terceiro', expected: 3 },
			];

			for (const { msg, expected } of tests) {
				const result = await classifier.classify(msg);
				expect(result.entities?.selection).toBe(expected);
			}
		});

		test('extrai URL', async () => {
			const result = await classifier.classify('https://youtube.com/watch?v=abc123 esse vídeo aqui');
			expect(result.entities?.url).toBe('https://youtube.com/watch?v=abc123');
		});

		test('extrai query de busca limpa', async () => {
			const result = await classifier.classify('mostra terror');
			expect(result.entities?.query).toBe('terror');
		});

		test('extrai query de info limpa', async () => {
			const result = await classifier.classify('o que é matrix');
			expect(result.entities?.query).toBe('matrix');
		});
	});

	describe('Extração de Seleção Numérica', () => {
		test('extrai número direto', async () => {
			const result = await classifier.classify('3');
			expect(result.entities?.selection).toBe(3);
		});

		test('extrai ordinal masculino', async () => {
			const result = await classifier.classify('o primeiro');
			expect(result.entities?.selection).toBe(1);
		});

		test('extrai ordinal feminino', async () => {
			const result = await classifier.classify('a segunda');
			expect(result.entities?.selection).toBe(2);
		});

		test('extrai cardinal', async () => {
			const result = await classifier.classify('um');
			expect(result.entities?.selection).toBe(1);
		});

		test('extrai com contexto', async () => {
			const result = await classifier.classify('opção 2');
			expect(result.entities?.selection).toBe(2);
		});

		test('ignora números grandes', async () => {
			const result = await classifier.classify('123');
			expect(result.entities?.selection).toBeUndefined();
		});
	});

	describe('Delete com Seleção', () => {
		test('detecta "exclui a nota 3"', async () => {
			const result = await classifier.classify('exclui a nota 3');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(3);
		});

		test('detecta "deleta o primeiro"', async () => {
			const result = await classifier.classify('deleta o primeiro');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(1);
		});

		test('detecta "apaga 2"', async () => {
			const result = await classifier.classify('apaga 2');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(2);
		});

		test('detecta "remove a terceira"', async () => {
			const result = await classifier.classify('remove a terceira');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(3);
		});

		test('detecta delete por query quando não há número', async () => {
			const result = await classifier.classify('deleta clube da luta');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_item');
			expect(result.entities?.query).toBe('clube da luta');
		});
	});
});
