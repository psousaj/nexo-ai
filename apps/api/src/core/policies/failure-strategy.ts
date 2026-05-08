export function toUserSafeFailureResponse(error: { code: string }): { mode: 'clarify' | 'defer' | 'text'; text: string } {
	if (error.code === 'transcription_failed') return { mode: 'clarify', text: 'Não entendi o áudio com segurança. Pode repetir?' };
	if (error.code === 'tool_timeout') return { mode: 'defer', text: 'Ainda estou processando isso. Vou tentar novamente.' };
	return { mode: 'text', text: 'Não consegui concluir isso com segurança agora.' };
}
