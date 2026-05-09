export function toUserSafeFailureResponse(error: { code: string }): { mode: 'clarify' | 'defer' | 'text'; text: string } {
	if (error.code === 'transcription_failed')
		return { mode: 'clarify', text: 'Não entendi o áudio com segurança. Pode repetir?' };
	if (error.code === 'tool_timeout')
		return { mode: 'defer', text: 'Ainda estou processando isso. Vou tentar novamente.' };
	if (error.code === 'no_results')
		return { mode: 'text', text: 'Não encontrei resultados para isso. Tente com outros termos.' };
	if (error.code === 'api_not_configured')
		return { mode: 'text', text: 'Essa funcionalidade não está configurada no momento.' };
	if (error.code === 'rate_limited')
		return { mode: 'defer', text: 'Estou recebendo muitas solicitações. Aguarde um instante.' };
	if (error.code === 'tool_not_found')
		return { mode: 'text', text: 'Não tenho essa ferramenta disponível no momento.' };
	if (error.code === 'tool_execution_error')
		return { mode: 'text', text: 'Ocorreu um erro ao executar essa ação. Tente novamente.' };
	if (error.code === 'tool_denied')
		return { mode: 'text', text: 'Não posso executar essa ação por motivos de segurança.' };
	return { mode: 'text', text: 'Não consegui concluir isso agora. Pode tentar de outra forma?' };
}
