import { buildAgentPrompt, buildClarificationPrompt, buildIntentClassifierPrompt } from '@/config/prompt-builder';
import { describe, expect, test } from 'vitest';

describe('yaml prompt builders', () => {
	test('buildAgentPrompt usa YAML como fonte e interpola nome/ferramentas', () => {
		const prompt = buildAgentPrompt({
			assistantName: 'Nexo',
			availableTools: ['save_note', 'search_items'],
		}).system;

		expect(prompt).toContain('Você é Nexo');
		expect(prompt).toContain('Ferramentas habilitadas no runtime atual: save_note, search_items');
		expect(prompt).toContain('Sempre responda em Português Brasileiro');
	});

	test('buildIntentClassifierPrompt retorna contrato JSON estrito em texto', () => {
		const prompt = buildIntentClassifierPrompt();
		expect(prompt).toContain('VOCÊ DEVE RESPONDER APENAS COM JSON VÁLIDO');
		expect(prompt).toContain('O primeiro caractere da resposta deve ser { e o último deve ser }');
	});

	test('buildClarificationPrompt injeta mensagem original, resposta e tentativas', () => {
		const prompt = buildClarificationPrompt({
			assistantName: 'Nexo',
			originalMessage: 'salva o onix',
			userResponse: 'é carro',
			attempt: 2,
			maxAttempts: 4,
		});

		expect(prompt).toContain('Você é Nexo');
		expect(prompt).toContain('salva o onix');
		expect(prompt).toContain('é carro');
		expect(prompt).toContain('Tentativa 2 de 4');
	});
});
