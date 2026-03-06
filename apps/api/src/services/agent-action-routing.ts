import type { ConversationState } from '@/types';
import type { IntentResult } from './intent-classifier';

export function decideAgentAction(intent: IntentResult, state: ConversationState, conversationFreedomEnabled: boolean): string {
	// Confirmação/Negação só importam se estamos aguardando
	if (state === 'awaiting_confirmation' || state === 'awaiting_final_confirmation') {
		if (intent.action === 'confirm') return 'handle_confirmation';
		if (intent.action === 'deny') return 'handle_denial';
	}

	// AÇÕES DETERMINÍSTICAS (execução direta, sem LLM)
	switch (intent.action) {
		case 'delete_all':
			return 'handle_delete_all';
		case 'delete_item':
		case 'delete_selected':
			return 'handle_delete_item';
		case 'list_all':
		case 'search':
			return 'handle_search';
		case 'save_previous':
			// Delegar ao LLM para resolver a referência contextual via resolve_context_reference
			return 'handle_with_llm';
		case 'greet':
		case 'thank':
			return conversationFreedomEnabled ? 'handle_with_llm' : 'handle_casual';
		case 'get_assistant_name':
			return 'handle_get_assistant_name';
	}

	if (intent.intent === 'casual_chat') {
		return conversationFreedomEnabled ? 'handle_with_llm' : 'handle_casual';
	}

	// Resto: delega para LLM
	return 'handle_with_llm';
}
