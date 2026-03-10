/**
 * Testes de isReminderHint no IntentClassifier
 *
 * `reminderHint` é setado em `entities.reminderHint` (não no nível raiz)
 * e apenas para intenções do tipo `save_content`.
 * Para frases puras de lembrete sem conteúdo a salvar, o campo não é preenchido.
 */

import { IntentClassifier } from '@/services/intent-classifier';
import { describe, expect, test } from 'vitest';

const classifier = new IntentClassifier();

describe('IntentClassifier — reminderHint', () => {
	describe('detecta reminderHint em save_content com padrão de lembrete', () => {
		test('"salva esse filme e me lembra de assistir" → save_content com entities.reminderHint', async () => {
			const result = await classifier.classify('salva esse filme e me lembra de assistir');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.reminderHint).toBe(true);
		});

		test('"guarda esse link e me lembre depois" → save_content com entities.reminderHint', async () => {
			const result = await classifier.classify('guarda esse link e me lembre depois');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.reminderHint).toBe(true);
		});

		test('"salva isso, preciso lembrar de assistir depois" → entities.reminderHint', async () => {
			const result = await classifier.classify('salva isso, preciso lembrar de assistir depois');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.reminderHint).toBe(true);
		});
	});

	describe('save_content sem padrão de lembrete → reminderHint ausente', () => {
		test('"salva esse filme" não tem reminderHint', async () => {
			const result = await classifier.classify('salva esse filme');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.reminderHint).toBeFalsy();
		});

		test('"guarda esse link" não tem reminderHint', async () => {
			const result = await classifier.classify('guarda esse link');
			expect(result.intent).toBe('save_content');
			expect(result.entities?.reminderHint).toBeFalsy();
		});
	});

	describe('outras intenções não têm reminderHint', () => {
		test('"lista tudo" → list_all sem reminderHint', async () => {
			const result = await classifier.classify('lista tudo que salvei');
			expect(result.intent).toBe('search_content');
			expect(result.entities?.reminderHint).toBeFalsy();
		});

		test('"deleta o primeiro" → delete_content sem reminderHint', async () => {
			const result = await classifier.classify('deleta o primeiro');
			expect(result.intent).toBe('delete_content');
			expect(result.entities?.reminderHint).toBeFalsy();
		});
	});
});
