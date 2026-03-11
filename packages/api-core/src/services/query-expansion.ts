/**
 * 🔥 Query Expansion Service
 *
 * Expande queries de busca para melhorar recall semântico
 *
 * Estratégia:
 * 1. Regras fixas (rápido, determinístico)
 * 2. Sinônimos e termos relacionados
 * 3. Tradução PT-BR ↔ EN (TMDB keywords são em inglês)
 *
 * Exemplo:
 * Input: "filmes sobre sonhos"
 * Output: "filmes sobre sonhos, dreams, subconsciente, subconscious, mente, mind, realidade alternativa, lucid dreaming"
 */

interface QueryExpansionMap {
	[key: string]: string[];
}

// 🧠 Mapa de expansão semântica (PT-BR + EN)
const SEMANTIC_EXPANSIONS: QueryExpansionMap = {
	// Temas cinematográficos
	sonho: ['dreams', 'dream world', 'subconsciente', 'subconscious', 'mente', 'mind', 'realidade alternativa'],
	espacial: ['space', 'spacecraft', 'astronaut', 'cosmos', 'universo', 'exploração espacial', 'space travel'],
	máfia: ['mafia', 'gangster', 'crime organizado', 'organized crime', 'família criminosa'],
	ação: ['action', 'aventura', 'adventure', 'luta', 'fight', 'explosão', 'explosion'],
	terror: ['horror', 'suspense', 'thriller', 'medo', 'fear', 'scary'],
	ficção: ['sci-fi', 'science fiction', 'futurista', 'futuristic', 'dystopia', 'utopia'],
	romance: ['romantic', 'amor', 'love', 'relationship', 'relacionamento'],
	comédia: ['comedy', 'funny', 'humor', 'risada', 'laugh'],
	drama: ['dramatic', 'emotional', 'emocional', 'tragedy', 'tragédia'],

	// Conceitos específicos
	tempo: ['time', 'temporal', 'viagem no tempo', 'time travel', 'paradoxo'],
	família: ['family', 'pai', 'father', 'mãe', 'mother', 'filho', 'daughter', 'família', 'family relationships'],
	vingança: ['revenge', 'vendetta', 'retaliação', 'retaliation'],
	guerra: ['war', 'battle', 'batalha', 'military', 'soldier', 'combate'],
	tecnologia: ['technology', 'artificial intelligence', 'AI', 'robot', 'robô', 'cyberpunk'],
	virtual: ['virtual reality', 'VR', 'simulação', 'simulation', 'digital'],

	// Veículos/Contextos
	carro: ['car', 'vehicle', 'corrida', 'race', 'velocidade', 'speed', 'street racing'],
	avião: ['airplane', 'aircraft', 'aviação', 'aviation', 'flight'],
	navio: ['ship', 'boat', 'naval', 'ocean', 'sea'],
};

// 🔤 Normalização de texto (remove acentos, lowercase)
function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, ''); // Remove acentos
}

/**
 * Expande query adicionando termos relacionados
 *
 * @param query - Query original do usuário
 * @param maxExpansions - Máximo de expansões (default: 3 por termo)
 * @returns Query expandida
 */
export function expandQuery(query: string, maxExpansions = 3): string {
	const normalizedQuery = normalizeText(query);
	const expansions = new Set<string>();

	// Adiciona query original
	expansions.add(query);

	// Busca expansões para cada palavra
	for (const [keyword, terms] of Object.entries(SEMANTIC_EXPANSIONS)) {
		if (normalizedQuery.includes(normalizeText(keyword))) {
			// Adiciona até maxExpansions termos relacionados
			terms.slice(0, maxExpansions).forEach((term) => expansions.add(term));
		}
	}

	return Array.from(expansions).join(', ');
}

/**
 * Expande query específica para filmes (adiciona contexto cinematográfico)
 */
export function expandMovieQuery(query: string): string {
	const expanded = expandQuery(query);

	// Se não mencionar "filme", adiciona contexto
	if (!normalizeText(query).includes('filme') && !normalizeText(query).includes('movie')) {
		return `filme, movie, ${expanded}`;
	}

	return expanded;
}

/**
 * Exemplo de uso com LLM (futuro)
 *
 * Pode usar um mini-LLM barato (Workers AI Llama) para expansão mais inteligente:
 *
 * Prompt: "Expanda esta busca com termos relacionados em PT-BR e EN: {query}"
 * Output: "sonhos, dreams, subconsciente, subconscious, mente, realidade alternativa"
 */
