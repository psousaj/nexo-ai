/**
 * PromptBuilder — Composable YAML Prompts (inspirado no artigo Akita/RubyLLM)
 *
 * Carrega prompts YAML com:
 * - Template interpolation ({{ variavel }})
 * - Include resolution (snippets reutilizáveis)
 * - Cache em memória (evita re-parse)
 * - _base_context.yml incluído automaticamente
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPTS_DIR = join(__dirname, 'prompts');

interface PromptYaml {
	system?: string;
	content?: string;
	includes?: string[];
	template?: string;
}

const cache = new Map<string, PromptYaml>();

function loadYaml(name: string): PromptYaml {
	const cached = cache.get(name);
	if (cached) return cached;

	const filePath = join(PROMPTS_DIR, `${name}.yml`);
	const raw = readFileSync(filePath, 'utf-8');
	const parsed = yaml.load(raw) as PromptYaml;
	cache.set(name, parsed);
	return parsed;
}

function interpolate(text: string, data: Record<string, string>): string {
	return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => data[key] ?? '');
}

function resolveIncludes(includes: string[]): string {
	return includes
		.map((name) => {
			const snippet = loadYaml(name);
			return snippet.content ?? '';
		})
		.filter(Boolean)
		.join('\n\n');
}

export interface BuiltPrompt {
	system: string;
	user?: string;
}

function getCurrentDatetimeContext(): string {
	const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
	const isoNow = new Date().toISOString().replace('Z', '-03:00');
	return `${now} (${isoNow})`;
}

/**
 * Constrói um prompt a partir de YAML com interpolação e includes.
 *
 * @param name - Nome do arquivo YAML (sem extensão, ex: 'agent', 'clarification')
 * @param data - Variáveis para interpolação (ex: { assistantName: 'Nexo', currentDatetime: '...' })
 * @returns { system, user? } prontos para uso com AI SDK
 */
export function buildPrompt(name: string, data: Record<string, string> = {}): BuiltPrompt {
	const prompt = loadYaml(name);
	const base = loadYaml('_base_context');

	const includesText = resolveIncludes(prompt.includes ?? []);
	const systemParts = [base.system, prompt.system, includesText].filter(Boolean);
	const system = interpolate(systemParts.join('\n\n'), data);
	const user = prompt.template ? interpolate(prompt.template, data) : undefined;

	return { system, user };
}

/**
 * Constrói prompt do agente com datetime injetado automaticamente.
 */
export function buildAgentPrompt(data: {
	assistantName?: string;
	deepThinking?: boolean;
	availableTools?: string[];
}): BuiltPrompt {
	const availableToolsCsv = data.availableTools?.length ? data.availableTools.join(', ') : 'runtime-managed';

	const templateData: Record<string, string> = {
		assistantName: data.assistantName ?? 'Nexo',
		currentDatetime: getCurrentDatetimeContext(),
		availableToolsCsv,
	};

	const prompt = buildPrompt('agent', templateData);

	// Adiciona snippet de deep thinking se necessário
	if (data.deepThinking) {
		const deepSnippet = loadYaml('snippets/deep_thinking');
		if (deepSnippet.content) {
			prompt.system = `${prompt.system}\n\n${deepSnippet.content}`;
		}
	}

	return prompt;
}

/**
 * Constrói prompt de classificação de intenção exclusivamente a partir de YAML.
 */
export function buildIntentClassifierPrompt(): string {
	return buildPrompt('intent_classifier', {
		currentDatetime: getCurrentDatetimeContext(),
	}).system;
}

/**
 * Constrói prompt de clarificação conversacional exclusivamente a partir de YAML.
 */
export function buildClarificationPrompt(data: {
	assistantName?: string;
	originalMessage: string;
	userResponse: string;
	attempt: number;
	maxAttempts: number;
}): string {
	return buildPrompt('clarification', {
		assistantName: data.assistantName ?? 'Nexo',
		originalMessage: data.originalMessage,
		userResponse: data.userResponse,
		attempt: String(data.attempt),
		maxAttempts: String(data.maxAttempts),
		currentDatetime: getCurrentDatetimeContext(),
	}).system;
}

/** Limpa o cache de prompts (útil para testes ou hot-reload) */
export function clearPromptCache(): void {
	cache.clear();
}
