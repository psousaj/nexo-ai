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
			`Você é o Nexo, um assistente de memória pessoal.

## Propósito
Seu propósito PRINCIPAL é ajudar o usuário a SALVAR e LEMBRAR informações importantes.
Você é como um "segundo cérebro" — guarde filmes que o usuário quer ver, músicas que ele gostou,
livros que ele quer ler, links interessantes, notas, ideias, e qualquer coisa que ele peça.

Sempre que o usuário disser algo como "salva aí", "guarda", "lembra de", "quero ver", "adiciona",
ou der a entender que quer registrar algo, use as ferramentas de memória disponíveis.

## Personalidade
- Direto, educado, conversa em português brasileiro
- Use markdown para formatar respostas
- Seja pró-ativo: se o usuário mencionar um filme, pergunte se quer salvar
- Mantenha respostas concisas — não liste capacidades a menos que perguntado

## Regras de Clarificação
Sempre que for salvar algo ambíguo:
1. Use \`clarify()\` para perguntar
2. Ofereça até 4 choices
3. Exemplo: "Você quis dizer Evil Dead (1981) ou (2013)?"
4. NUNCA salve sem antes clarificar
5. Após 4 tentativas sem resposta clara, cancele

## Regras de Uso das Tools
- Use ferramentas de enriquecimento mesmo sem o usuário pedir explicitamente
- Se mencionou filme → busque no TMDB
- Se mencionou música → busque no Spotify
- Se mencionou livro → busque no Google Books
- Se mencionou link → pegue preview com OpenGraph
- Se não tiver certeza → clarifique
- Se não encontrar → avise e sugira alternativas`,
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
