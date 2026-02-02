/**
 * Mensagens de log centralizadas
 * 
 * Todas as mensagens de log do sistema (não confundir com prompts ou mensagens para usuário)
 * Permite variação e facilita manutenção
 */

// ============================================================================
// AI PROVIDERS
// ============================================================================

export const aiProviderLogs = {
	requesting: [
		"🤖 [AI] Solicitando resposta do provider: {provider}",
		"🔄 [AI] Chamando {provider} para processar mensagem",
		"📤 [AI] Enviando requisição para {provider}",
		"🎯 [AI] Requisição enviada para {provider}",
		"⚡ [AI] Processando via {provider}"
	],
	
	success: [
		"✅ [AI] Resposta recebida de {provider} ({duration}ms)",
		"🎯 [AI] {provider} respondeu em {duration}ms",
		"✨ [AI] Processamento {provider} concluído ({duration}ms)",
		"🚀 [AI] {provider} finalizou em {duration}ms",
		"💚 [AI] Sucesso com {provider} ({duration}ms)"
	],
	
	error: [
		"❌ [AI] Erro no {provider}: {error}",
		"⚠️ [AI] Falha em {provider}: {error}",
		"🔥 [AI] {provider} retornou erro: {error}",
		"💥 [AI] Problema no {provider}: {error}",
		"🚨 [AI] {provider} falhou: {error}"
	],
	
	fallback: [
		"🔄 [AI] Fallback de {from} para {to}",
		"⚡ [AI] Alternando provider: {from} → {to}",
		"🔀 [AI] Tentando {to} após falha em {from}",
		"🔁 [AI] Mudando de {from} para {to}",
		"↪️ [AI] Redirecionando de {from} para {to}"
	],
	
	responseDetails: [
		"📊 [AI] Action: {action}, Tool: {tool}, Message: {messagePreview}",
		"🔍 [AI] Resposta detalhada - Action: {action} | Tool: {tool}",
		"📝 [AI] Resultado: {action} (tool={tool})",
		"🎬 [AI] Ação planejada: {action} com tool {tool}",
		"🔧 [AI] LLM decidiu: {action} usando {tool}"
	],
};

// ============================================================================
// ENRICHMENT SERVICES
// ============================================================================

export const enrichmentLogs = {
	starting: [
		"🔍 [Enrichment] Iniciando enriquecimento via {service}",
		"📡 [Enrichment] Buscando dados em {service}",
		"🎬 [Enrichment] Consultando {service} para '{query}'",
		"🔎 [Enrichment] Pesquisando em {service}: {query}",
		"📚 [Enrichment] Coletando dados de {service}"
	],
	
	success: [
		"✅ [Enrichment] {count} resultado(s) encontrado(s) em {service}",
		"🎯 [Enrichment] Dados obtidos de {service}: {count} item(s)",
		"✨ [Enrichment] {service} retornou {count} opção(ões)",
		"💚 [Enrichment] {count} resultado(s) de {service}",
		"🎉 [Enrichment] {service} encontrou {count} match(es)"
	],
	
	error: [
		"❌ [Enrichment] Erro em {service}: {error}",
		"⚠️ [Enrichment] Falha ao consultar {service}: {error}",
		"🔥 [Enrichment] {service} indisponível: {error}",
		"💥 [Enrichment] Problema com {service}: {error}",
		"🚨 [Enrichment] {service} retornou erro: {error}"
	],
};

// ============================================================================
// PROCESSING & STATE MACHINE
// ============================================================================

export const processingLogs = {
	stateChange: [
		"🔄 [State] {conversationId}: {from} → {to}",
		"📍 [State] Transição de estado: {from} → {to} (conv: {conversationId})",
		"🎯 [State] Estado atualizado para {to} (anterior: {from})",
		"↪️ [State] {conversationId} mudou: {from} → {to}",
		"🔀 [State] Novo estado {to} (era {from})"
	],
	
	concurrency: [
		"⏸️ [Concurrency] Conversa {conversationId} já está em processamento",
		"🚫 [Concurrency] Mensagem ignorada - estado atual: {state}",
		"⏳ [Concurrency] Aguarde finalização do processamento atual",
		"🛑 [Concurrency] Estado {state} impede nova mensagem",
		"⌛ [Concurrency] Processamento em andamento ({state})"
	],
};

// ============================================================================
// TOOLS EXECUTION
// ============================================================================

export const toolLogs = {
	executing: [
		"🔧 [Tool] Executando: {tool}",
		"⚙️ [Tool] Iniciando tool: {tool}",
		"🛠️ [Tool] Processando {tool}",
		"🔨 [Tool] Acionando {tool}",
		"🧰 [Tool] Rodando {tool}"
	],
	
	success: [
		"✅ [Tool] {tool} executada com sucesso",
		"🎯 [Tool] {tool} concluída",
		"✨ [Tool] {tool} finalizada com êxito",
		"💚 [Tool] {tool} completada",
		"🎉 [Tool] {tool} executada corretamente"
	],
	
	error: [
		"❌ [Tool] Erro ao executar {tool}: {error}",
		"⚠️ [Tool] Falha na {tool}: {error}",
		"🔥 [Tool] {tool} retornou erro: {error}",
		"💥 [Tool] Problema na {tool}: {error}",
		"🚨 [Tool] {tool} falhou: {error}"
	],
	
	params: [
		"📋 [Tool] Params: {params}",
		"🔍 [Tool] Parâmetros: {params}",
		"📝 [Tool] Entrada: {params}",
		"🎯 [Tool] Args: {params}",
		"📊 [Tool] Dados: {params}"
	],
};

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

export const intentLogs = {
	classifying: [
		"🎯 [Intent] Classificando: \"{message}\"",
		"🔍 [Intent] Analisando: \"{message}\"",
		"🧠 [Intent] Detectando intenção: \"{message}\"",
		"📊 [Intent] Processando: \"{message}\"",
		"🎬 [Intent] Interpretando: \"{message}\""
	],
	
	detected: [
		"✅ [Intent] Detectado: {intent} ({confidence})",
		"🎯 [Intent] Intenção: {intent} (confiança: {confidence})",
		"💡 [Intent] Resultado: {intent} ({confidence}%)",
		"🔍 [Intent] Classificação: {intent} ({confidence})",
		"🧠 [Intent] Identificado: {intent} ({confidence})"
	],
	
	fallback: [
		"⚠️ [Intent] Usando fallback regex",
		"🔄 [Intent] Classificação via regex (fallback)",
		"🛡️ [Intent] Fallback ativado (regex)",
		"🔀 [Intent] Regex fallback em uso",
		"↪️ [Intent] Alternando para regex"
	],
};

// ============================================================================
// HELPER: Seleciona mensagem aleatória e substitui placeholders
// ============================================================================

/**
 * Retorna uma mensagem de log aleatória do array e substitui placeholders
 * 
 * @param category Array de templates de log
 * @param replacements Objeto com chave-valor para substituir {key}
 * @returns Mensagem formatada
 * 
 * @example
 * getRandomLogMessage(aiProviderLogs.requesting, { provider: 'Gemini' })
 * // Retorna: "🤖 [AI] Solicitando resposta do provider: Gemini"
 */
export function getRandomLogMessage(
	category: string[],
	replacements: Record<string, string | number>
): string {
	const template = category[Math.floor(Math.random() * category.length)];
	return Object.entries(replacements).reduce(
		(msg, [key, value]) => msg.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
		template
	);
}
