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
import { join, dirname } from 'node:path';
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
export function buildAgentPrompt(data: { assistantName?: string; deepThinking?: boolean }): BuiltPrompt {
	const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
	const isoNow = new Date().toISOString().replace('Z', '-03:00');

	const templateData: Record<string, string> = {
		assistantName: data.assistantName ?? 'Nexo',
		currentDatetime: `${now} (${isoNow})`,
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

/** Limpa o cache de prompts (útil para testes ou hot-reload) */
export function clearPromptCache(): void {
	cache.clear();
}
