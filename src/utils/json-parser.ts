/**
 * Utilitário para parsear JSON de respostas LLM
 * Remove markdown code blocks e limpa o JSON
 */

/**
 * Remove markdown code blocks e parseia JSON
 * Suporta formatos:
 * - ```json\n{...}\n```
 * - ```\n{...}\n```
 * - {...}
 */
export function parseJSONFromLLM(text: string): any {
	if (!text?.trim()) {
		throw new Error('Texto vazio');
	}

	// Remove markdown code blocks (```json ou ```)
	let cleaned = text.trim();
	
	// Remove ```json e ``` no começo/fim
	cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
	
	// Remove espaços em branco extras
	cleaned = cleaned.trim();

	// Tenta parsear
	try {
		return JSON.parse(cleaned);
	} catch (error) {
		console.error('❌ [JSON Parser] Falha ao parsear:', cleaned.substring(0, 200));
		throw new Error(`JSON inválido: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
	}
}

/**
 * Valida se é um AgentLLMResponse válido
 */
export function isValidAgentResponse(obj: any): boolean {
	if (!obj || typeof obj !== 'object') return false;
	
	// Valida campos obrigatórios
	if (!obj.schema_version || !obj.action) return false;
	
	// Valida action
	const validActions = ['CALL_TOOL', 'RESPOND', 'NOOP'];
	if (!validActions.includes(obj.action)) return false;
	
	// Se CALL_TOOL, precisa ter tool
	if (obj.action === 'CALL_TOOL' && !obj.tool) return false;
	
	// Se RESPOND, precisa ter message
	if (obj.action === 'RESPOND' && !obj.message) return false;
	
	return true;
}
