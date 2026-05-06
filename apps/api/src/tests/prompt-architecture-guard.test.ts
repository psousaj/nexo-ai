import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

function findRepoRoot(fromDir: string): string {
	let current = fromDir;
	while (current !== dirname(current)) {
		if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
			return current;
		}
		current = dirname(current);
	}
	throw new Error('Não foi possível localizar a raiz do monorepo (pnpm-workspace.yaml)');
}

function walkFiles(rootDir: string): string[] {
	const ignored = new Set(['node_modules', '.git', 'dist', '.turbo', 'coverage', '.next', '.nuxt', 'build']);
	const out: string[] = [];

	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			if (ignored.has(entry)) continue;
			const full = join(dir, entry);
			const stats = statSync(full);
			if (stats.isDirectory()) {
				walk(full);
				continue;
			}
			const ext = extname(full);
			if (ext === '.ts' || ext === '.tsx' || ext === '.mts') {
				out.push(full);
			}
		}
	};

	walk(rootDir);
	return out;
}

describe('prompt architecture guard (yaml-first)', () => {
	test('bloqueia imports diretos de config/prompts no monorepo', () => {
		const repoRoot = findRepoRoot(resolve(__dirname, '../../../..'));
		const scopes = [join(repoRoot, 'apps'), join(repoRoot, 'packages')];
		const offenders: Array<{ file: string; matches: string[] }> = [];

		for (const scope of scopes) {
			if (!existsSync(scope)) continue;
			const files = walkFiles(scope);
			for (const file of files) {
				const content = readFileSync(file, 'utf-8');
				const matches = content.match(/config\/prompts(?=['"`])/g) || [];
				if (matches.length > 0) {
					offenders.push({ file: file.replace(`${repoRoot}/`, ''), matches });
				}
			}
		}

		expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
	});

	test('message-templates não exporta prompts de LLM em TypeScript', () => {
		const repoRoot = findRepoRoot(resolve(__dirname, '../../../..'));
		const file = join(repoRoot, 'apps/api/src/config/message-templates.ts');
		const content = readFileSync(file, 'utf-8');

		const forbiddenTokens = [
			'AGENT_SYSTEM_PROMPT',
			'INTENT_CLASSIFIER_PROMPT',
			'CLARIFICATION_CONVERSATIONAL_PROMPT',
			'getAgentSystemPrompt',
			'applyAgentDecisionV2Contract',
		];

		for (const token of forbiddenTokens) {
			expect(content.includes(token), `Token proibido encontrado: ${token}`).toBe(false);
		}
	});
});
