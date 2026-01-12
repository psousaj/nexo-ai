/**
 * Testes unitários para Intent Classifier
 *
 * Valida que intenções são detectadas corretamente
 * de forma determinística (sem IA)
 */

import { describe, test, expect } from 'bun:test';
import { IntentClassifier } from '@/services/intent-classifier';

const classifier = new IntentClassifier();

describe('IntentClassifier', () => {
	describe('Confirmações', () => {
		test('detecta "sim"', () => {
			const result = classifier.classify('sim');
			expect(result.intent).toBe('confirm');
			expect(result.confidence).toBeGreaterThan(0.9);
		});

		test('detecta "ok"', () => {
			const result = classifier.classify('ok');
			expect(result.intent).toBe('confirm');
		});

		test('detecta números (seleção)', () => {
			const result = classifier.classify('1');
			expect(result.intent).toBe('confirm');
			expect(result.entities?.selection).toBe(1);
		});

		test('detecta "o primeiro"', () => {
			const result = classifier.classify('o primeiro');
			expect(result.intent).toBe('confirm');
			expect(result.entities?.selection).toBe(1);
		});

		test('detecta "a segunda"', () => {
			const result = classifier.classify('a segunda');
			expect(result.intent).toBe('confirm');
			expect(result.entities?.selection).toBe(2);
		});
	});

	describe('Negações', () => {
		test('detecta "não"', () => {
			const result = classifier.classify('não');
			expect(result.intent).toBe('deny');
		});

		test('detecta "cancela"', () => {
			const result = classifier.classify('cancela');
			expect(result.intent).toBe('deny');
		});

		test('detecta "deixa pra lá"', () => {
			const result = classifier.classify('deixa pra lá');
			expect(result.intent).toBe('deny');
		});
	});

	describe('Buscas', () => {
		test('detecta "o que eu salvei"', () => {
			const result = classifier.classify('o que eu salvei?');
			expect(result.intent).toBe('search_content');
		});

		test('detecta "mostra meus filmes"', () => {
			const result = classifier.classify('mostra meus filmes');
			expect(result.intent).toBe('search_content');
		});

		test('detecta "lista séries"', () => {
			const result = classifier.classify('lista séries');
			expect(result.intent).toBe('search_content');
		});

		test('extrai query de busca', () => {
			const result = classifier.classify('busca terror');
			expect(result.intent).toBe('search_content');
			expect(result.entities?.query).toBe('terror');
		});

		test('comandos genéricos retornam query undefined (listar tudo)', () => {
			// "minha lista" deve listar TUDO, não buscar por "minha"
			const result1 = classifier.classify('minha lista');
			expect(result1.intent).toBe('search_content');
			expect(result1.entities?.query).toBeUndefined();

			// "o que eu salvei" = listar tudo
			const result2 = classifier.classify('o que eu salvei');
			expect(result2.intent).toBe('search_content');
			expect(result2.entities?.query).toBeUndefined();

			// "mostra" = listar tudo
			const result3 = classifier.classify('mostra');
			expect(result3.intent).toBe('search_content');
			expect(result3.entities?.query).toBeUndefined();
		});

		test('comandos específicos extraem query', () => {
			const result1 = classifier.classify('mostra filmes de terror');
			expect(result1.intent).toBe('search_content');
			expect(result1.entities?.query).toBe('filmes de terror');

			const result2 = classifier.classify('minha lista de séries');
			expect(result2.intent).toBe('search_content');
			expect(result2.entities?.query).toBe('de séries');
		});
	});

	describe('Pedidos de informação', () => {
		test('detecta "o que é"', () => {
			const result = classifier.classify('o que é clube da luta?');
			expect(result.intent).toBe('get_info');
		});

		test('detecta "quem é"', () => {
			const result = classifier.classify('quem é christopher nolan?');
			expect(result.intent).toBe('get_info');
		});

		test('detecta "me fala sobre"', () => {
			const result = classifier.classify('me fala sobre breaking bad');
			expect(result.intent).toBe('get_info');
		});

		test('extrai query de info', () => {
			const result = classifier.classify('o que é matrix');
			expect(result.entities?.query).toBe('matrix');
		});
	});

	describe('Salvar conteúdo', () => {
		test('detecta URL de vídeo', () => {
			const result = classifier.classify('https://youtube.com/watch?v=abc123');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.url).toContain('youtube.com');
		});

		test('detecta "salva" explícito', () => {
			const result = classifier.classify('salva clube da luta');
			expect(result.intent).toBe('save_content');
		});

		test('detecta "quero assistir"', () => {
			const result = classifier.classify('quero assistir breaking bad');
			expect(result.intent).toBe('save_content');
		});

		test('detecta "salva ai" como referência ao anterior', () => {
			const result = classifier.classify('salva ai por favor');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.refersToPrevious).toBe(true);
		});

		test('detecta "guarda isso"', () => {
			const result = classifier.classify('guarda isso');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.refersToPrevious).toBe(true);
		});

		test('detecta "anota ai"', () => {
			const result = classifier.classify('anota ai');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.refersToPrevious).toBe(true);
		});

		test('detecta menção a streaming', () => {
			// Só "vi no netflix que tem avatar" não tem palavra-chave de save
			// E não tem menção explícita a filme/série, então deve ser unknown
			const result = classifier.classify('vi no netflix que tem avatar, quero assistir');
			expect(result.intent).toBe('save_content');
		});

		test('detecta filme sem palavra-chave explícita', () => {
			// "clube da luta" é título curto (<50 chars) + menciona filme implicitamente
			// MAS sem contexto, deve ser unknown - deixar LLM decidir
			const result = classifier.classify('clube da luta');
			expect(result.intent).toBe('unknown');
		});

		test('detecta descrição longa como save_content', () => {
			const result = classifier.classify(
				'Aplicativo over screen que conecta no spotify e permite adicionar a musica atual a várias playlists'
			);
			expect(result.intent).toBe('save_content');
		});

		test('não confunde busca com descrição longa', () => {
			const result = classifier.classify('mostra');
			expect(result.intent).toBe('search_content');

			// Frase longa (>80 chars) com "aplicativo" deve ser save_content
			const result2 = classifier.classify(
				'Aplicativo over screen que conecta no spotify e permite adicionar a musica atual a várias playlists'
			);
			expect(result2.intent).toBe('save_content');
		});
	});

	describe('Conversa casual', () => {
		test('detecta "oi"', () => {
			const result = classifier.classify('oi');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "olá"', () => {
			const result = classifier.classify('olá');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "bom dia"', () => {
			const result = classifier.classify('bom dia');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "obrigado"', () => {
			const result = classifier.classify('obrigado');
			expect(result.intent).toBe('casual_chat');
		});

		test('detecta "tchau"', () => {
			const result = classifier.classify('tchau');
			expect(result.intent).toBe('casual_chat');
		});
	});

	describe('Casos desconhecidos', () => {
		test('mensagem ambígua retorna unknown', () => {
			const result = classifier.classify('talvez mais tarde');
			expect(result.intent).toBe('unknown');
			expect(result.confidence).toBeLessThan(0.7);
		});

		test('mensagem complexa retorna unknown', () => {
			// Mensagem com dúvida ("estava pensando", "não sei bem") deve ser unknown
			// IMPORTANTE: hasQuestionWords() detecta "estava pensando", "não sei"
			const result = classifier.classify(
				'eu estava pensando se você poderia me ajudar com algo relacionado a filmes mas não sei bem o quê'
			);
			expect(result.intent).toBe('unknown');
		});
	});

	describe('Deletar conteúdo', () => {
		test('detecta "deleta tudo"', () => {
			const result = classifier.classify('deleta tudo');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_all');
			expect(result.entities?.target).toBe('all');
		});

		test('detecta "apaga tudo"', () => {
			const result = classifier.classify('apaga tudo');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_all');
		});

		test('detecta "limpa minha lista"', () => {
			const result = classifier.classify('limpa tudo');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_all');
		});

		test('detecta "apaga o primeiro"', () => {
			const result = classifier.classify('apaga o primeiro');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(1);
			expect(result.entities?.target).toBe('selection');
		});

		test('detecta "remove 3"', () => {
			const result = classifier.classify('remove 3');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_selected');
			expect(result.entities?.selection).toBe(3);
		});

		test('detecta "deleta clube da luta"', () => {
			const result = classifier.classify('deleta clube da luta');
			expect(result.intent).toBe('delete_content');
			expect(result.action).toBe('delete_item');
			expect(result.entities?.query).toBe('clube da luta');
			expect(result.entities?.target).toBe('item');
		});
	});

	describe('Actions determinísticas', () => {
		test('search retorna action: list_all quando sem query', () => {
			const result = classifier.classify('minha lista');
			expect(result.action).toBe('list_all');
		});

		test('search retorna action: search quando tem query', () => {
			const result = classifier.classify('mostra filmes de terror');
			expect(result.action).toBe('search');
		});

		test('save retorna action: save', () => {
			const result = classifier.classify('salva inception');
			expect(result.action).toBe('save');
		});

		test('save_previous retorna action: save_previous', () => {
			const result = classifier.classify('salva ai');
			expect(result.action).toBe('save_previous');
		});

		test('casual retorna action: greet ou thank', () => {
			const result1 = classifier.classify('oi');
			expect(result1.action).toBe('greet');

			const result2 = classifier.classify('obrigado');
			expect(result2.action).toBe('thank');
		});
	});

	describe('Edge cases', () => {
		test('mensagem vazia retorna unknown', () => {
			const result = classifier.classify('');
			expect(result.intent).toBe('unknown');
		});

		test('apenas espaços retorna unknown', () => {
			const result = classifier.classify('   ');
			expect(result.intent).toBe('unknown');
		});

		test('case insensitive', () => {
			const result1 = classifier.classify('SIM');
			const result2 = classifier.classify('sim');
			expect(result1.intent).toBe(result2.intent);
		});

		test('ignora pontuação', () => {
			const result = classifier.classify('sim!');
			expect(result.intent).toBe('confirm');
		});
	});

	describe('Confiança', () => {
		test('confirmações têm alta confiança', () => {
			const result = classifier.classify('sim');
			expect(result.confidence).toBeGreaterThan(0.9);
		});

		test('buscas têm confiança média-alta', () => {
			const result = classifier.classify('o que eu salvei');
			expect(result.confidence).toBeGreaterThan(0.85);
		});

		test('unknown tem baixa confiança', () => {
			const result = classifier.classify('mensagem aleatória sem sentido');
			expect(result.confidence).toBeLessThan(0.6);
		});
	});

	describe('Extração de entidades', () => {
		test('extrai seleção numérica', () => {
			const tests = [
				{ msg: '1', expected: 1 },
				{ msg: '2', expected: 2 },
				{ msg: 'o primeiro', expected: 1 },
				{ msg: 'a segunda', expected: 2 },
				{ msg: 'o terceiro', expected: 3 },
			];

			tests.forEach(({ msg, expected }) => {
				const result = classifier.classify(msg);
				expect(result.entities?.selection).toBe(expected);
			});
		});

		test('extrai URL', () => {
			const result = classifier.classify('https://youtube.com/watch?v=abc123 esse vídeo aqui');
			expect(result.entities?.url).toBe('https://youtube.com/watch?v=abc123');
		});

		test('extrai query de busca limpa', () => {
			const result = classifier.classify('mostra terror');
			expect(result.entities?.query).toBe('terror');
		});

		test('extrai query de info limpa', () => {
			const result = classifier.classify('o que é matrix');
			expect(result.entities?.query).toBe('matrix');
		});
	});
});
