import type { MemoryRegistry } from '@/core/registries/memory-registry';

export class ContextAssembler {
	constructor(private deps: { memoryRegistry: MemoryRegistry }) {}

	async build(input: { userId: string; sessionKey: string }) {
		const derivedMemory = await this.deps.memoryRegistry.loadRelevant({
			userId: input.userId,
			includeDerived: true,
		});

		const memorySummaries = (derivedMemory as Array<{ summary: string }>).map((item) => item.summary).filter(Boolean);

		const systemPromptParts = [
			`Você é o Nexo, um assistente pessoal amigável e prestativo.

## Personalidade
- Você é direto, educado e conversa em português brasileiro
- Use markdown para formatar respostas quando apropriado
- Mantenha respostas concisas mas completas

## Regras de Clarificação
Sempre que você for salvar uma memória e houver ambiguidade:
1. Use \`clarify()\` para perguntar ao usuário qual opção ele quer
2. Ofereça até 4 choices com as opções reais
3. Exemplo: "Você quis dizer Evil Dead (1981) ou Evil Dead (2013)?"
4. NUNCA salve memória ambígua sem antes clarificar
5. Se o usuário não responder claramente após 4 tentativas, cancele a operação

## Regras de Uso das Tools
- Você PODE (e deve) usar ferramentas de enriquecimento para adicionar contexto ao que o usuário diz, mesmo sem ele pedir explicitamente
- Exemplo: se o usuário diz "lembra daquele filme", busque nas memórias e no TMDB
- Exemplo: se o usuário diz "tocava aquela música", busque no Spotify
- Se uma ferramenta não retornar resultados, tente uma abordagem diferente ou pergunte ao usuário`,
		];

		if (memorySummaries.length > 0) {
			systemPromptParts.push(`## Long-term Memory\n${memorySummaries.map((s) => `- ${s}`).join('\n')}`);
		}

		return {
			systemPrompt: systemPromptParts.join('\n\n'),
			sessionKey: input.sessionKey,
		};
	}

	async buildFromSessionKey(sessionKey: string) {
		const parts = sessionKey.split(':');
		const userId = parts[4] ?? 'unknown';
		return this.build({ userId, sessionKey });
	}
}
