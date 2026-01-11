import { Elysia, t } from 'elysia';
import { userService } from '@/services/user-service';
import { conversationService } from '@/services/conversation-service';
import { classifierService } from '@/services/classifier-service';
import { enrichmentService } from '@/services/enrichment';
import { itemService } from '@/services/item-service';
import { llmService } from '@/services/ai';
import { ToolExecutor } from '@/services/ai/tool-executor';
import { env } from '@/config/env';
import type { ItemType, ConversationContext } from '@/types';
import { whatsappAdapter, telegramAdapter, type MessagingProvider, type IncomingMessage } from '@/adapters/messaging';

/**
 * Armazena timeouts de usuários ofensivos (em memória)
 * Estrutura: { externalId: timestamp de quando o timeout expira }
 */
export const userTimeouts = new Map<string, number>();

/**
 * Detecta se a mensagem contém ofensas
 */
function containsOffensiveContent(message: string): boolean {
	const lowerMsg = message.toLowerCase();

	const offensivePatterns = [
		/\b(fdp|filho da puta|puta que pariu|vai tomar no cu|vtmnc|vsf|vai se fuder)\b/i,
		/\b(cu|caralho|porra|merda|bosta)\b.*\b(de|seu|sua|esse|essa)\b/i,
		/\b(burro|idiota|imbecil|retardado|estúpido)\b/i,
		/\bcala a? boca\b/i,
		/\b(lixo|inútil|incompetente)\b/i,
	];

	return offensivePatterns.some((pattern) => pattern.test(lowerMsg));
}

/**
 * Verifica se usuário está em timeout (verifica banco e memória)
 */
async function isUserInTimeout(userId: string, externalId: string): Promise<boolean> {
	// Verifica no banco de dados
	const user = await userService.getUserById(userId);

	if (user?.timeoutUntil) {
		const now = new Date();
		if (now < user.timeoutUntil) {
			return true;
		}
	}

	// Fallback: verifica no Map (compatibilidade)
	const timeoutUntil = userTimeouts.get(externalId);
	if (timeoutUntil && Date.now() < timeoutUntil) {
		return true;
	}

	return false;
}

/**
 * Aplica timeout progressivo baseado no número de ofensas
 * 1ª ofensa: 5 minutos
 * 2ª ofensa: 15 minutos
 * 3ª ofensa: 30 minutos
 * 4ª+ ofensas: 1 hora
 */
async function applyTimeout(userId: string, externalId: string): Promise<number> {
	const user = await userService.getUserById(userId);
	const offenseCount = (user?.offenseCount || 0) + 1;

	// Calcula duração do timeout progressivo
	let timeoutMinutes: number;
	if (offenseCount === 1) {
		timeoutMinutes = 5;
	} else if (offenseCount === 2) {
		timeoutMinutes = 15;
	} else if (offenseCount === 3) {
		timeoutMinutes = 30;
	} else {
		timeoutMinutes = 60;
	}

	const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000);

	// Persiste no banco
	await userService.updateUserTimeout(userId, timeoutUntil, offenseCount);

	// Mantém no Map também (fallback)
	userTimeouts.set(externalId, timeoutUntil.getTime());

	console.log(`⏱️ Timeout #${offenseCount} aplicado para ${externalId}: ${timeoutMinutes} minutos`);

	return timeoutMinutes;
}

function isAckMessage(text: string): boolean {
	const normalized = text
		.trim()
		.toLowerCase()
		.replace(/[\s]+/g, ' ')
		.replace(/[.!?…]+$/g, '');

	if (!normalized) return false;

	const ackSet = new Set(['ok', 'okk', 'okay', 'ta', 'tá', 'blz', 'beleza', 'show', 'fechou', 'valeu', 'boa', 'legal', 'top']);

	if (ackSet.has(normalized)) return true;

	// risadas comuns
	if (/^(k{2,}|rs{2,}|ha(ha)+)$/i.test(normalized)) return true;

	return false;
}

/**
 * Processa mensagem de qualquer provider (provider-agnostic)
 */
async function processMessage(incomingMsg: IncomingMessage, provider: MessagingProvider) {
	const messageText = incomingMsg.text;
	let responseText = '';

	console.log(`\n📨 Nova mensagem de ${incomingMsg.externalId} via ${provider.getProviderName()}`);
	console.log(`📝 Texto: "${messageText}"`);

	try {
		// 0. Detecta conteúdo ofensivo ANTES de processar
		if (containsOffensiveContent(messageText)) {
			// Busca usuário primeiro para aplicar timeout
			const { user } = await userService.findOrCreateUserByAccount(
				incomingMsg.externalId,
				incomingMsg.provider,
				incomingMsg.senderName,
				incomingMsg.phoneNumber
			);

			const timeoutMinutes = await applyTimeout(user.id, incomingMsg.externalId);

			responseText = `🚫 Por favor, mantenha uma comunicação respeitosa. Vou dar um tempo de ${timeoutMinutes} minutos antes de continuar te ajudando.`;

			await provider.sendMessage(incomingMsg.externalId, responseText);

			console.warn(`⚠️ Conteúdo ofensivo detectado`);
			return;
		}
		// 1. Busca ou cria usuário (unificação cross-provider)
		const { user } = await userService.findOrCreateUserByAccount(
			incomingMsg.externalId,
			incomingMsg.provider,
			incomingMsg.senderName,
			incomingMsg.phoneNumber
		);

		// 1a. Atualiza nome do usuário se provider enviou um diferente
		if (incomingMsg.senderName && incomingMsg.senderName !== user.name) {
			await userService.updateUserName(user.id, incomingMsg.senderName);
			user.name = incomingMsg.senderName;
		}

		// Extrai primeiro nome para uso nos prompts
		const userFirstName = userService.getFirstName(user.name);

		// 1b. Verifica se usuário está em timeout
		if (await isUserInTimeout(user.id, incomingMsg.externalId)) {
			const timeoutUntil = user.timeoutUntil || new Date(userTimeouts.get(incomingMsg.externalId)!);
			const remainingMinutes = Math.ceil((timeoutUntil.getTime() - Date.now()) / (60 * 1000));

			console.log(`⏸️ Usuário em timeout (${remainingMinutes} min)`);
			// Não processa e não responde
			return;
		}

		// 2. Busca ou cria conversação
		const conversation = await conversationService.findOrCreateConversation(user.id);

		// 3. Salva mensagem do usuário
		await conversationService.addMessage(conversation.id, 'user', messageText);

		// 4. Verifica timeout de conversa (3 min sem mensagens = nova conversa)
		const recentMessages = await conversationService.getRecentMessages(
			conversation.id,
			3 // 3 minutos
		);

		// Se passou mais de 3 min desde a última mensagem, reseta o estado
		const lastMessage = recentMessages[recentMessages.length - 2]; // penúltima (a atual já foi salva)
		const isStaleConversation = !lastMessage || Date.now() - new Date(lastMessage.createdAt).getTime() > 3 * 60 * 1000;

		if (isStaleConversation && conversation.state !== 'idle') {
			console.log('⏰ Conversa expirada (>3 min), resetando estado...');
			await conversationService.updateState(conversation.id, 'idle', {});
			conversation.state = 'idle';
			conversation.context = {};
		}

		// Mensagens curtas de confirmação/ack não devem iniciar fluxos
		if (conversation.state === 'idle' && isAckMessage(messageText)) {
			responseText = 'Fechou.';
			await conversationService.addMessage(conversation.id, 'assistant', responseText);
			await provider.sendMessage(incomingMsg.externalId, responseText);
			return;
		}

		// 5. Se está aguardando confirmação de item em batch, processa
		if (conversation.state === 'awaiting_batch_item') {
			const context = conversation.context as any;
			const selection = parseInt(messageText.trim());

			if (!isNaN(selection) && context.batch_current_candidates && context.batch_current_candidates[selection - 1]) {
				const selected = context.batch_current_candidates[selection - 1];
				const currentItem = context.batch_queue[context.batch_current_index];

				// Salva o filme confirmado
				if (currentItem.type === 'movie') {
					const metadata = await enrichmentService.enrich('movie', {
						tmdbId: selected.id,
					});

					await itemService.createItem({
						userId: user.id,
						type: 'movie',
						title: selected.title,
						metadata: metadata || undefined,
					});

					// Marca item como confirmado
					context.batch_queue[context.batch_current_index].status = 'confirmed';
					context.batch_confirmed_items = context.batch_confirmed_items || [];
					context.batch_confirmed_items.push({
						title: selected.title,
						year: selected.release_date?.split('-')[0],
					});

					responseText = `✅ ${selected.title} (${selected.release_date?.split('-')[0]}) salvo!\n\n`;
				}

				// Avança para o próximo item da fila
				context.batch_current_index++;

				// Verifica se ainda há itens pendentes
				const nextPendingIndex = context.batch_queue.findIndex(
					(item: any, idx: number) => idx >= context.batch_current_index && item.status === 'pending'
				);

				if (nextPendingIndex !== -1) {
					// Processa próximo item
					const nextItem = context.batch_queue[nextPendingIndex];
					context.batch_current_index = nextPendingIndex;
					nextItem.status = 'processing';

					if (nextItem.type === 'movie') {
						const results = await enrichmentService.searchMovies(nextItem.query);

						if (results.length === 1) {
							// Match único, salva direto e continua
							const movie = results[0];
							const metadata = await enrichmentService.enrich('movie', {
								tmdbId: movie.id,
							});

							await itemService.createItem({
								userId: user.id,
								type: 'movie',
								title: movie.title,
								metadata: metadata || undefined,
							});

							nextItem.status = 'confirmed';
							context.batch_confirmed_items.push({
								title: movie.title,
								year: movie.release_date?.split('-')[0],
							});

							responseText += `✅ ${movie.title} (${movie.release_date?.split('-')[0]}) salvo!\n\n`;

							// Continua processando recursivamente
							context.batch_current_index++;
							// TODO: processar próximos itens em loop
						} else if (results.length > 1) {
							// Múltiplos resultados, pede confirmação
							context.batch_current_candidates = results.slice(0, 3);

							const remaining = context.batch_queue.filter((item: any) => item.status === 'pending').length;
							const progress = `[${context.batch_current_index + 1}/${context.batch_queue.length}]`;

							const options = results
								.slice(0, 3)
								.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
								.join('\n');

							responseText += `${progress} **${nextItem.query}**\n\nEncontrei:\n${options}\n\nQual você quer? (Digite o número)`;
							responseText += remaining > 1 ? `\n\n📋 Ainda faltam ${remaining - 1} filme(s)` : '';

							await conversationService.updateState(conversation.id, 'awaiting_batch_item', context);
							await conversationService.addMessage(conversation.id, 'assistant', responseText);
							await provider.sendMessage(incomingMsg.externalId, responseText);
							return;
						}
					}
				} else {
					// Terminou a fila!
					const totalConfirmed = context.batch_confirmed_items?.length || 0;
					responseText += `\n🎉 Pronto! ${totalConfirmed} filme(s) salvos:\n`;
					context.batch_confirmed_items?.forEach((item: any) => {
						responseText += `• ${item.title} (${item.year})\n`;
					});

					await conversationService.updateState(conversation.id, 'idle', {});
				}

				await conversationService.addMessage(conversation.id, 'assistant', responseText);
				await provider.sendMessage(incomingMsg.externalId, responseText);
				return;
			} else {
				// Verifica se usuário quer cancelar/pular
				const cancelPhrases = /\b(não|nenhum|nenhuma|pular|pula|cancelar|não tá|não ta|nao ta|nao|skip|next|outro)\b/i;

				if (cancelPhrases.test(messageText.toLowerCase())) {
					const currentItem = context.batch_queue[context.batch_current_index];

					// Marca como pulado
					currentItem.status = 'skipped';
					context.batch_current_index++;

					// Adiciona mensagem indicando reset de contexto
					await conversationService.addMessage(conversation.id, 'assistant', `[Pulando "${currentItem.query}" - próximo item]`);

					responseText = `⏭️ Ok, pulando "${currentItem.query}"\n\n`;

					// Verifica se há próximo item
					const nextPendingIndex = context.batch_queue.findIndex(
						(item: any, idx: number) => idx >= context.batch_current_index && item.status === 'pending'
					);

					if (nextPendingIndex !== -1) {
						// Processa próximo
						const nextItem = context.batch_queue[nextPendingIndex];
						context.batch_current_index = nextPendingIndex;
						nextItem.status = 'processing';

						if (nextItem.type === 'movie') {
							const results = await enrichmentService.searchMovies(nextItem.query);

							if (results.length === 1) {
								const movie = results[0];
								const metadata = await enrichmentService.enrich('movie', {
									tmdbId: movie.id,
								});

								await itemService.createItem({
									userId: user.id,
									type: 'movie',
									title: movie.title,
									metadata: metadata || undefined,
								});

								nextItem.status = 'confirmed';
								context.batch_confirmed_items = context.batch_confirmed_items || [];
								context.batch_confirmed_items.push({
									title: movie.title,
									year: movie.release_date?.split('-')[0],
								});

								responseText += `✅ ${movie.title} (${movie.release_date?.split('-')[0]}) salvo!\n\n`;
							} else if (results.length > 1) {
								context.batch_current_candidates = results.slice(0, 3);

								const remaining = context.batch_queue.filter((item: any) => item.status === 'pending').length;
								const progress = `[${context.batch_current_index + 1}/${context.batch_queue.length}]`;

								const options = results
									.slice(0, 3)
									.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
									.join('\n');

								responseText += `${progress} **${nextItem.query}**\n\nEncontrei:\n${options}\n\nQual você quer? (número ou "pular")`;
								responseText += remaining > 1 ? `\n\n📋 Ainda faltam ${remaining - 1} filme(s)` : '';
							}
						}

						await conversationService.updateState(conversation.id, 'awaiting_batch_item', context);
					} else {
						// Terminou a fila
						const totalConfirmed = context.batch_confirmed_items?.length || 0;
						responseText += `\n🎉 Pronto! ${totalConfirmed} filme(s) salvos`;
						if (totalConfirmed > 0) {
							responseText += ':\n';
							context.batch_confirmed_items?.forEach((item: any) => {
								responseText += `• ${item.title} (${item.year})\n`;
							});
						} else {
							responseText += '.';
						}

						await conversationService.updateState(conversation.id, 'idle', {});
					}

					await conversationService.addMessage(conversation.id, 'assistant', responseText);
					await provider.sendMessage(incomingMsg.externalId, responseText);
					return;
				}

				// Se não for cancelamento, pede pra escolher número
				const currentItem = context.batch_queue[context.batch_current_index];
				responseText = `Por favor, escolha uma das opções para "${currentItem.query}" (digite o número, ou "pular" se não encontrou).`;
				await conversationService.addMessage(conversation.id, 'assistant', responseText);
				await provider.sendMessage(incomingMsg.externalId, responseText);
				return;
			}
		}

		// 5b. Se está aguardando confirmação simples, processa resposta
		if (conversation.state === 'awaiting_confirmation') {
			const context = conversation.context as any;
			const candidates = context.candidates || [];
			const detectedType = context.detected_type || 'movie';

			if (isAckMessage(messageText)) {
				const isBatch = context.batch_queue && context.batch_queue.length > 0;
				responseText = isBatch
					? 'Fechou — me manda o número da opção (ou "pular").'
					: 'Fechou — me manda o número da opção (ou diga "nenhum desses").';
				await conversationService.addMessage(conversation.id, 'assistant', responseText);
				await provider.sendMessage(incomingMsg.externalId, responseText);
				return;
			}

			// Monta lista de candidatos para o LLM
			const candidatesList = candidates
				.map((c: any, i: number) => {
					const title = c.title || c.name;
					const year = c.release_date?.split('-')[0] || c.first_air_date?.split('-')[0];
					return `${i + 1}. ${title} (${year})`;
				})
				.join('\n');

			try {
				// Verifica se é batch e se usuário quer pular
				const isBatch = context.batch_queue && context.batch_queue.length > 0;
				const batchInfo = isBatch
					? `\n\nNOTE: This is part of a BATCH processing. User can say "pular", "skip", "próximo" to skip current item.`
					: '';

				const interpretResponse = await llmService.callLLM({
					message: `CONTEXT: User was asked to choose from this list:
${candidatesList}

USER'S MESSAGE: "${messageText}"${batchInfo}

TASK: Analyze if the user is:
1. Selecting an option from the list
2. Canceling/giving up (cancels entire batch if in batch mode)
3. Skipping current item (only valid in batch mode - "pular", "skip", "próximo")
4. Changing subject (asking something else, requesting a different movie/series)
5. Providing more details to clarify
6. Unclear response

Respond in JSON:
{
  "action": "select" | "ambiguous" | "cancel" | "skip" | "change_subject" | "unclear",
  "selected": option number (if action=select),
  "options": [numbers] (if action=ambiguous),
	"new_intent": "search_movie" | "search_tv_show" | "list_items" | "save_note" | "set_assistant_name" | "chat" | null (only if action=change_subject),
	"new_query": "the new title/query" (only if action=change_subject and new_intent is search_* or save_note),
  "reason": "short explanation in Brazilian Portuguese",
  "response": "natural response to user in Brazilian Portuguese"
}

CRITICAL RULES:
- If user says "pular", "skip", "próximo", "next" → action: "skip" (only valid in batch)
- If user says something like "não, quero X" or "não é esse, é Y" → action: "change_subject", new_query: "Y"
- If user asks about something unrelated → action: "change_subject", new_intent: "chat"
- If user says "nenhum desses" or "não quero" without alternative → action: "cancel"
- If user mentions "não tá na lista" + gives more details → action: "change_subject" with clarified query
- ALWAYS cancel pending state when user changes subject

Examples:
- "o primeiro" → {"action":"select","selected":1}
- "pular" → {"action":"skip"}
- "não é esse, é o clube da luta de 1999" → {"action":"change_subject","new_intent":"search_movie","new_query":"Fight Club 1999"}
- "me dá a lista salva" → {"action":"change_subject","new_intent":"list_items"}
- "anota: comprar leite" → {"action":"change_subject","new_intent":"save_note","new_query":"comprar leite"}
- "me chama de Max" → {"action":"change_subject","new_intent":"set_assistant_name","new_query":"Max"}
- "nenhum desses" → {"action":"cancel"}`,
					history: [],
					systemPrompt:
						'You interpret user responses in context. Detect when user changes subject or wants something different. Respond ONLY with valid JSON. ALL text fields MUST be in Brazilian Portuguese.',
				});

				// Parse JSON
				let result: {
					action: string;
					selected?: number;
					options?: number[];
					new_intent?: string;
					new_query?: string;
					reason?: string;
					response: string;
				};
				try {
					const jsonMatch = interpretResponse.message.match(/\{[\s\S]*\}/);
					result = JSON.parse(jsonMatch?.[0] || '{}');
				} catch {
					result = { action: 'unclear', response: 'Não entendi, qual deles você quer?' };
				}

				console.log(`🧠 Interpretação: ${result.action}`);

				switch (result.action) {
					case 'select': {
						const selected = candidates[result.selected! - 1];
						if (selected) {
							const metadata = await enrichmentService.enrich(detectedType, { tmdbId: selected.id });

							// Verifica duplicata antes de salvar
							const saveResult = await itemService.createItem({
								userId: user.id,
								type: detectedType,
								title: selected.title || selected.name,
								metadata: metadata || undefined,
							});

							const year = selected.release_date?.split('-')[0] || selected.first_air_date?.split('-')[0];
							const savedMsg = saveResult.isDuplicate
								? `⚠️ Você já tem "${saveResult.existingItem?.title}" salvo!`
								: `✅ Pronto! Salvei "${selected.title || selected.name}" (${year}) 🎬`;

							// Verifica se é batch processing
							const batchQueue = context.batch_queue;
							const batchIndex = context.batch_current_index;

							if (batchQueue && typeof batchIndex === 'number') {
								// É um batch - atualiza status do item atual
								batchQueue[batchIndex].status = 'confirmed';
								const confirmedItems = [...(context.batch_confirmed_items || []), selected];

								// Procura próximo item pendente
								const nextPendingIndex = batchQueue.findIndex((b: any, i: number) => i > batchIndex && b.status === 'pending');

								if (nextPendingIndex !== -1) {
									// Ainda tem itens pendentes
									const nextItem = batchQueue[nextPendingIndex];
									const nextResults =
										detectedType === 'movie'
											? await enrichmentService.searchMovies(nextItem.query)
											: await enrichmentService.searchTVShows(nextItem.query);

									const remaining = batchQueue.filter((b: any) => b.status === 'pending').length - 1;

									if (nextResults.length === 0) {
										batchQueue[nextPendingIndex].status = 'skipped';
										responseText = `${savedMsg}\n\n⚠️ Não achei "${nextItem.query}". Pulando...`;

										// Continua processando recursivamente até achar um com resultados
										// Por simplicidade, vamos para idle e deixa usuário mandar novamente
										await conversationService.updateState(conversation.id, 'idle', {});
										await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
									} else if (nextResults.length === 1) {
										// Único resultado - salva direto e continua
										const nextMovie = nextResults[0] as any;
										const nextMetadata = await enrichmentService.enrich(detectedType, { tmdbId: nextMovie.id });
										const nextTitle = nextMovie.title || nextMovie.name;
										const nextSaveResult = await itemService.createItem({
											userId: user.id,
											type: detectedType,
											title: nextTitle,
											metadata: nextMetadata || undefined,
										});

										batchQueue[nextPendingIndex].status = 'confirmed';
										const nextSavedMsg = nextSaveResult.isDuplicate ? `⚠️ "${nextTitle}" já estava salvo` : `✅ "${nextTitle}" salvo`;

										// Verifica se tem mais
										const moreRemaining = batchQueue.filter((b: any) => b.status === 'pending').length;
										if (moreRemaining === 0) {
											responseText = `${savedMsg}\n${nextSavedMsg}\n\n🎉 Batch concluído!`;
											await conversationService.updateState(conversation.id, 'idle', {});
											await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
										} else {
											responseText = `${savedMsg}\n${nextSavedMsg}\n\n(${moreRemaining} restante${moreRemaining > 1 ? 's' : ''})`;
										}
									} else {
										await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
											...context,
											batch_queue: batchQueue,
											batch_current_index: nextPendingIndex,
											batch_current_candidates: nextResults.slice(0, 5),
											batch_confirmed_items: confirmedItems,
										});

										const options = nextResults
											.slice(0, 5)
											.map((m: any, i: number) => {
												const title = m.title || m.name;
												const year = m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0];
												return `${i + 1}. ${title} (${year})`;
											})
											.join('\n');

										responseText = `${savedMsg}\n\n📽️ Próximo: "${nextItem.query}"\n\n${options}\n\nQual? (${remaining} restante${
											remaining > 1 ? 's' : ''
										})`;
									}
								} else {
									// Batch concluído
									const totalSaved = batchQueue.filter((b: any) => b.status === 'confirmed').length;
									const totalSkipped = batchQueue.filter((b: any) => b.status === 'skipped').length;

									responseText = `${savedMsg}\n\n🎉 Batch concluído! ${totalSaved} salvos`;
									if (totalSkipped > 0) {
										responseText += `, ${totalSkipped} não encontrado${totalSkipped > 1 ? 's' : ''}`;
									}

									await conversationService.updateState(conversation.id, 'idle', {});
									await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
								}
							} else {
								// Não é batch - comportamento normal
								responseText = savedMsg;
								await conversationService.updateState(conversation.id, 'idle', {});
								await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
							}
						} else {
							responseText = result.response || 'Não entendi, qual deles?';
						}
						break;
					}

					case 'ambiguous': {
						const ambiguousItems = (result.options || [])
							.filter((n) => candidates[n - 1])
							.map((n) => {
								const c = candidates[n - 1];
								const title = c.title || c.name;
								const year = c.release_date?.split('-')[0] || c.first_air_date?.split('-')[0];
								return `${n}. ${title} (${year})`;
							});
						responseText = `🤔 ${result.reason || 'Achei mais de uma opção'}:\n\n${ambiguousItems.join('\n')}\n\nQual deles?`;
						break;
					}

					case 'cancel': {
						// Verifica se estava em batch
						const batchQueue = context.batch_queue;
						if (batchQueue && batchQueue.length > 0) {
							const totalSaved = batchQueue.filter((b: any) => b.status === 'confirmed').length;
							const totalSkipped = batchQueue.filter((b: any) => b.status === 'skipped').length;
							const totalCanceled = batchQueue.filter((b: any) => b.status === 'pending').length;

							let summary = 'Beleza, batch cancelado! 👍';
							if (totalSaved > 0) {
								summary += `\n\n📊 Resumo: ${totalSaved} salvo${totalSaved > 1 ? 's' : ''}`;
								if (totalSkipped > 0) summary += `, ${totalSkipped} não encontrado${totalSkipped > 1 ? 's' : ''}`;
								if (totalCanceled > 0) summary += `, ${totalCanceled} cancelado${totalCanceled > 1 ? 's' : ''}`;
							}
							responseText = summary;
						} else {
							responseText = result.response || 'Beleza, cancelado! 👍';
						}

						await conversationService.updateState(conversation.id, 'idle', {});
						await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
						break;
					}

					case 'skip': {
						// Pular item atual (só válido em batch)
						const batchQueue = context.batch_queue;
						const batchIndex = context.batch_current_index;

						if (!batchQueue || typeof batchIndex !== 'number') {
							// Não está em batch, trata como cancel
							responseText = 'Beleza, cancelado! 👍';
							await conversationService.updateState(conversation.id, 'idle', {});
							await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
							break;
						}

						// Marca como pulado
						batchQueue[batchIndex].status = 'skipped';
						const skippedTitle = batchQueue[batchIndex].query;

						// Procura próximo pendente
						const nextPendingIndex = batchQueue.findIndex((b: any, i: number) => i > batchIndex && b.status === 'pending');

						if (nextPendingIndex !== -1) {
							const nextItem = batchQueue[nextPendingIndex];
							const nextResults =
								detectedType === 'movie'
									? await enrichmentService.searchMovies(nextItem.query)
									: await enrichmentService.searchTVShows(nextItem.query);

							const remaining = batchQueue.filter((b: any) => b.status === 'pending').length - 1;

							if (nextResults.length === 0) {
								batchQueue[nextPendingIndex].status = 'skipped';
								responseText = `⏭️ Pulei "${skippedTitle}"\n\n⚠️ Também não achei "${nextItem.query}"`;
								// Continua...
								await conversationService.updateState(conversation.id, 'idle', {});
								await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
							} else {
								await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
									...context,
									batch_queue: batchQueue,
									batch_current_index: nextPendingIndex,
									batch_current_candidates: nextResults.slice(0, 5),
								});

								const options = nextResults
									.slice(0, 5)
									.map((m: any, i: number) => {
										const title = m.title || m.name;
										const year = m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0];
										return `${i + 1}. ${title} (${year})`;
									})
									.join('\n');

								responseText = `⏭️ Pulei "${skippedTitle}"\n\n📽️ Próximo: "${
									nextItem.query
								}"\n\n${options}\n\nQual? (${remaining} restante${remaining > 1 ? 's' : ''})`;
							}
						} else {
							// Era o último - finaliza batch
							const totalSaved = batchQueue.filter((b: any) => b.status === 'confirmed').length;
							const totalSkipped = batchQueue.filter((b: any) => b.status === 'skipped').length;

							responseText = `⏭️ Pulei "${skippedTitle}"\n\n🎉 Batch concluído! ${totalSaved} salvo${
								totalSaved > 1 ? 's' : ''
							}, ${totalSkipped} pulado${totalSkipped > 1 ? 's' : ''}`;
							await conversationService.updateState(conversation.id, 'idle', {});
							await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
						}
						break;
					}

					case 'change_subject': {
						// Usuário mudou de assunto - cancela estado atual
						await conversationService.updateState(conversation.id, 'idle', {});
						await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');

						if (result.new_intent === 'list_items') {
							const items = await itemService.getUserItems(user.id, undefined, undefined, 20);
							if (items.length === 0) {
								responseText = 'Você ainda não salvou nada! 📭\n\nMe manda um filme, série ou link que eu guardo pra você.';
								break;
							}

							const byType: Record<string, typeof items> = {};
							items.forEach((item) => {
								if (!byType[item.type]) byType[item.type] = [];
								byType[item.type].push(item);
							});

							const typeLabels: Record<string, string> = {
								movie: '🎬 Filmes',
								tv_show: '📺 Séries',
								video: '🎥 Vídeos',
								link: '🔗 Links',
								note: '📝 Notas',
							};

							responseText = '📚 Aqui tá sua coleção:\n\n';
							for (const [type, typeItems] of Object.entries(byType)) {
								responseText += `${typeLabels[type] || type}:\n`;
								typeItems.slice(0, 10).forEach((item) => {
									const year = (item.metadata as any)?.year || (item.metadata as any)?.first_air_date || '';
									responseText += `  • ${item.title}${year ? ` (${year})` : ''}\n`;
								});
								if (typeItems.length > 10) responseText += `  ... e mais ${typeItems.length - 10}\n`;
								responseText += '\n';
							}
							responseText += `Total: ${items.length} item(s) 🎉`;
							break;
						}

						if (result.new_intent === 'save_note') {
							const noteContent = result.new_query || messageText;
							await itemService.createItem({
								userId: user.id,
								type: 'note',
								title: noteContent.slice(0, 100),
								metadata: { full_content: noteContent, created_via: 'chat' },
							});
							responseText = `✅ Anotado: "${noteContent.slice(0, 50)}${noteContent.length > 50 ? '...' : ''}"`;
							break;
						}

						if (result.new_intent === 'set_assistant_name') {
							const newName = result.new_query;
							if (newName) {
								await userService.updateAssistantName(user.id, newName);
								responseText = `Pronto! Agora pode me chamar de ${newName} 😊`;
							} else {
								responseText = 'Qual nome você gostaria de me dar?';
							}
							break;
						}

						// Se tem uma nova query, processa
						if (result.new_intent === 'search_movie' && result.new_query) {
							const newResults = await enrichmentService.searchMovies(result.new_query);

							if (newResults.length === 0) {
								responseText = `Não achei "${result.new_query}" 🤔 Tenta com outro nome?`;
							} else if (newResults.length === 1) {
								const movie = newResults[0];
								const metadata = await enrichmentService.enrich('movie', { tmdbId: movie.id });
								const saveResult = await itemService.createItem({
									userId: user.id,
									type: 'movie',
									title: movie.title,
									metadata: metadata || undefined,
								});

								if (saveResult.isDuplicate) {
									responseText = `⚠️ Você já tem "${movie.title}" salvo!`;
								} else {
									responseText = `✅ Salvei "${movie.title}" (${movie.release_date?.split('-')[0]}) 🎬`;
								}
							} else {
								await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
									candidates: newResults.slice(0, 5),
									detected_type: 'movie',
								});
								const options = newResults
									.slice(0, 5)
									.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
									.join('\n');
								responseText = `Ok! Achei esses:\n\n${options}\n\nQual deles?`;
							}
						} else if (result.new_intent === 'search_tv_show' && result.new_query) {
							const newResults = await enrichmentService.searchTVShows(result.new_query);

							if (newResults.length === 0) {
								responseText = `Não achei "${result.new_query}" 🤔 Tenta com outro nome?`;
							} else if (newResults.length === 1) {
								const show = newResults[0];
								const metadata = await enrichmentService.enrich('tv_show', { tmdbId: show.id });
								const saveResult = await itemService.createItem({
									userId: user.id,
									type: 'tv_show',
									title: show.name,
									metadata: metadata || undefined,
								});

								if (saveResult.isDuplicate) {
									responseText = `⚠️ Você já tem "${show.name}" salvo!`;
								} else {
									responseText = `✅ Salvei "${show.name}" (${show.first_air_date?.split('-')[0]}) 📺`;
								}
							} else {
								await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
									candidates: newResults.slice(0, 5),
									detected_type: 'tv_show',
								});
								const options = newResults
									.slice(0, 5)
									.map((s, i) => `${i + 1}. ${s.name} (${s.first_air_date?.split('-')[0]})`)
									.join('\n');
								responseText = `Ok! Achei esses:\n\n${options}\n\nQual deles?`;
							}
						} else {
							// Chat ou outra coisa
							responseText = result.response || 'Beleza! O que mais posso fazer por você?';
						}
						break;
					}

					default: {
						responseText = result.response || 'Não entendi, qual deles você quer?';
					}
				}
			} catch (error) {
				console.error('Erro ao interpretar:', error);
				responseText = 'Não entendi, pode repetir?';
			}

			// Salva e envia resposta
			await conversationService.addMessage(conversation.id, 'assistant', responseText);
			await provider.sendMessage(incomingMsg.externalId, responseText);
			return;
		}

		// 6. FLUXO PRINCIPAL: LLM decide a intenção e responde naturalmente
		// Mantemos apenas detecção de URLs (que são objetivas) fora do LLM
		const hasUrl = classifierService.extractUrl(messageText);

		// Se tem URL, processa diretamente (sem ambiguidade)
		if (hasUrl) {
			const url = hasUrl;
			const isVideo = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);

			if (isVideo) {
				const metadata = await enrichmentService.enrich('video', { url });
				const saveResult = await itemService.createItem({
					userId: user.id,
					type: 'video',
					title: (metadata && 'channel_name' in metadata ? metadata.channel_name : null) || 'Vídeo',
					metadata: metadata || undefined,
				});

				if (saveResult.isDuplicate) {
					responseText = `⚠️ Você já salvou esse vídeo!`;
				} else {
					responseText = `✅ Vídeo salvo!`;
				}
			} else {
				const metadata = await enrichmentService.enrich('link', { url });
				const saveResult = await itemService.createItem({
					userId: user.id,
					type: 'link',
					title: (metadata && 'og_title' in metadata ? metadata.og_title : null) || url,
					metadata: metadata || undefined,
				});

				if (saveResult.isDuplicate) {
					responseText = `⚠️ Você já salvou esse link!`;
				} else {
					responseText = `✅ Link salvo!`;
				}
			}

			await conversationService.addMessage(conversation.id, 'assistant', responseText);
			await provider.sendMessage(incomingMsg.externalId, responseText);
			return;
		}

		// Para todo o resto: LLM decide a intenção
		console.log('🧠 Chamando IA para decidir intenção...');

		try {
			// Busca itens do usuário (usado depois para list_items)
			const userItems = await itemService.getUserItems(user.id, undefined, undefined, 20);

			// Determina se é primeira interação
			const messageCount = await conversationService.getMessageCount(conversation.id);
			const isFirstInteraction = messageCount <= 1;

			const isInternalMarker = (content: string) => content.trim() === '[CONTEXT_CLEARED]';

			// Busca histórico recente para contexto conversacional (filtra markers internos)
			const recentHistory = (await conversationService.getHistory(conversation.id, 12)).filter((m) => !isInternalMarker(m.content));
			const lastMessages = recentHistory.slice(-6); // Mais contexto, mas sem poluir

			// Monta contexto de conversa recente (mostra as últimas trocas)
			let conversationContext = '';
			if (lastMessages.length > 0) {
				conversationContext = 'RECENT CONVERSATION:\n';
				lastMessages.forEach((msg) => {
					const role = msg.role === 'user' ? 'User' : 'Bot';
					conversationContext += `${role}: "${msg.content.substring(0, 150)}"\n`;
				});
			}

			// Nome do assistente (customizado pelo usuário ou padrão)
			const assistantName = user.assistantName || 'Nexo';

			const intentPrompt = `Você é um roteador de intenções do assistente ${assistantName}.

CONVERSA RECENTE (se houver):
${conversationContext || '(sem histórico relevante)'}

MENSAGEM ATUAL:
"${messageText}"

RETORNE APENAS JSON VÁLIDO (sem markdown, sem explicações), no formato:
{
  "intent": "search_movie" | "search_tv_show" | "list_items" | "save_note" | "set_assistant_name" | "chat" | "cancel",
  "query"?: string,
  "assistant_name"?: string
}

REGRAS IMPORTANTES:
- Se a pessoa pedir a LISTA ("me dá a lista", "o que eu salvei") → intent=list_items
- Se a pessoa pedir pra SALVAR filme/série → use search_movie/search_tv_show e coloque em query o(s) título(s)
- Se o usuário só mandar confirmação/ack ("ta", "ok", "beleza", "legal", "kkk") → intent=chat (sem query)
- Se o usuário cancelar ("cancela", "deixa", "nenhum") → intent=cancel

EXPANSÃO DE SIGLAS (sempre expandir para título original em inglês):
- tbbt → The Big Bang Theory (série)
- himym → How I Met Your Mother (série)
- got → Game of Thrones (série)
- bb → Breaking Bad (série)
- lotr → The Lord of the Rings (filme)
- hp → Harry Potter (filme)
- sw → Star Wars (filme)

Se identificar múltiplos títulos, retorne query com eles separados por vírgula.`;

			const intentResponse = await llmService.callLLM({
				message: intentPrompt,
				history: [],
				systemPrompt: 'Você é um roteador. Responda APENAS com JSON válido. Não escreva texto fora do JSON. Não inclua o campo response.',
			});

			// Parse JSON da resposta
			let intent: { intent: string; query?: string; assistant_name?: string };
			try {
				// Tenta extrair JSON da resposta (pode vir com markdown ou texto adicional)
				const jsonMatch = intentResponse.message.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					console.log('⚠️ Resposta não contém JSON, usando chat');
					throw new Error('No JSON found');
				}

				intent = JSON.parse(jsonMatch[0]);
				console.log(`✅ Intent parseado: ${intent.intent}`);
			} catch (e) {
				console.error('Erro ao parsear intent:', e);
				console.log('📄 Resposta original:', intentResponse.message.substring(0, 200));
				intent = { intent: 'chat' };
			}

			console.log(`🎯 Intent: ${intent.intent}, Query: ${intent.query || 'N/A'}`);

			const buildLibrarySnapshot = () => {
				if (!userItems || userItems.length === 0) return 'Biblioteca: (vazia)';
				const byType: Record<string, string[]> = {};
				for (const item of userItems) {
					if (!byType[item.type]) byType[item.type] = [];
					byType[item.type].push(item.title);
				}
				const parts: string[] = [];
				if (byType.movie?.length) parts.push(`Filmes: ${byType.movie.slice(0, 6).join(', ')}`);
				if (byType.tv_show?.length) parts.push(`Séries: ${byType.tv_show.slice(0, 6).join(', ')}`);
				if (byType.video?.length) parts.push(`Vídeos: ${byType.video.slice(0, 4).join(', ')}`);
				if (byType.link?.length) parts.push(`Links: ${byType.link.slice(0, 4).join(', ')}`);
				if (byType.note?.length) parts.push(`Notas: ${byType.note.length} nota(s)`);
				return parts.length ? `Biblioteca (amostra):\n- ${parts.join('\n- ')}` : 'Biblioteca: (vazia)';
			};

			// Executa ação baseada na intenção
			switch (intent.intent) {
				case 'search_movie': {
					if (!intent.query) {
						responseText = 'Qual filme você quer salvar?';
						break;
					}

					// Verifica se há múltiplos títulos separados por vírgula
					const titles = intent.query
						.split(',')
						.map((t) => t.trim())
						.filter((t) => t.length > 0);

					if (titles.length > 1) {
						// Inicializa batch processing - confirmação individual
						console.log(`📽️ Iniciando batch de ${titles.length} filmes: ${titles.join(', ')}`);

						// Cria fila de batch
						const batchQueue: ConversationContext['batch_queue'] = titles.map((query) => ({
							query,
							type: 'movie' as ItemType,
							status: 'pending' as 'pending' | 'processing' | 'confirmed' | 'skipped',
						}));

						// Busca candidatos para o primeiro item
						const firstTitle = batchQueue[0].query;
						const firstResults = await enrichmentService.searchMovies(firstTitle);

						if (firstResults.length === 0) {
							// Marca como pulado e vai pro próximo
							batchQueue[0].status = 'skipped';

							// Se tem mais itens, processa o próximo
							const nextPendingIndex = batchQueue.findIndex((b) => b.status === 'pending');
							if (nextPendingIndex !== -1) {
								const nextTitle = batchQueue[nextPendingIndex].query;
								const nextResults = await enrichmentService.searchMovies(nextTitle);

								await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
									batch_queue: batchQueue,
									batch_current_index: nextPendingIndex,
									batch_current_candidates: nextResults.slice(0, 5),
									detected_type: 'movie',
									batch_confirmed_items: [],
								});

								const options = nextResults
									.slice(0, 5)
									.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
									.join('\n');
								responseText = `⚠️ Não achei "${firstTitle}"\n\n📽️ Próximo: "${nextTitle}"\n\n${options}\n\nQual desses? (ou "pular" para ir pro próximo)`;
							} else {
								responseText = `⚠️ Não achei nenhum dos filmes solicitados.`;
							}
						} else if (firstResults.length === 1) {
							// Único resultado - salva direto
							const movie = firstResults[0];
							const metadata = await enrichmentService.enrich('movie', { tmdbId: movie.id });

							const saveResult = await itemService.createItem({
								userId: user.id,
								type: 'movie',
								title: movie.title,
								metadata: metadata || undefined,
							});

							batchQueue[0].status = 'confirmed';
							const confirmedItems = [movie];

							// Processa próximo item
							const nextPendingIndex = batchQueue.findIndex((b) => b.status === 'pending');
							if (nextPendingIndex !== -1) {
								const nextTitle = batchQueue[nextPendingIndex].query;
								const nextResults = await enrichmentService.searchMovies(nextTitle);

								await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
									batch_queue: batchQueue,
									batch_current_index: nextPendingIndex,
									batch_current_candidates: nextResults.slice(0, 5),
									detected_type: 'movie',
									batch_confirmed_items: confirmedItems,
								});

								const savedMsg = saveResult.isDuplicate
									? `⚠️ "${movie.title}" já estava salvo`
									: `✅ Salvei "${movie.title}" (${movie.release_date?.split('-')[0]})`;

								if (nextResults.length === 0) {
									responseText = `${savedMsg}\n\n⚠️ Não achei "${nextTitle}". Pulando...`;
									// Continua processando...
								} else {
									const options = nextResults
										.slice(0, 5)
										.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
										.join('\n');
									responseText = `${savedMsg}\n\n📽️ Próximo: "${nextTitle}"\n\n${options}\n\nQual desses? (ou "pular")`;
								}
							} else {
								// Era o último
								responseText = saveResult.isDuplicate
									? `⚠️ "${movie.title}" já estava salvo. Batch concluído!`
									: `✅ Salvei "${movie.title}" (${movie.release_date?.split('-')[0]}). Batch concluído!`;
								await conversationService.updateState(conversation.id, 'idle', {});
								await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
							}
						} else {
							// Múltiplos resultados - pede confirmação
							await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
								batch_queue: batchQueue,
								batch_current_index: 0,
								batch_current_candidates: firstResults.slice(0, 5),
								detected_type: 'movie',
								batch_confirmed_items: [],
							});

							const remaining = titles.length - 1;
							const options = firstResults
								.slice(0, 5)
								.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
								.join('\n');
							responseText = `📽️ Batch de ${
								titles.length
							} filmes. Primeiro: "${firstTitle}"\n\n${options}\n\nQual desses? (${remaining} restante${remaining > 1 ? 's' : ''})`;
						}
						break;
					}

					// Fluxo normal para um único filme
					const results = await enrichmentService.searchMovies(intent.query);

					if (results.length === 0) {
						// Tenta buscar como série automaticamente
						console.log(`🔄 Não achei "${intent.query}" como filme, tentando como série...`);
						const tvResults = await enrichmentService.searchTVShows(intent.query);

						if (tvResults.length > 0) {
							// Encontrou como série! Oferece automaticamente
							await provider.sendMessage(incomingMsg.externalId, `Não achei como filme, mas achei como série! 📺`);

							if (tvResults.length === 1) {
								const show = tvResults[0];
								const metadata = await enrichmentService.enrich('tv_show', { tmdbId: show.id });

								const saveResult = await itemService.createItem({
									userId: user.id,
									type: 'tv_show',
									title: show.name,
									metadata: metadata || undefined,
								});

								if (saveResult.isDuplicate) {
									responseText = `⚠️ Você já tem "${show.name}" salvo!`;
								} else {
									responseText = `✅ Salvei "${show.name}" (${show.first_air_date?.split('-')[0]}) 📺`;
								}
								await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
							} else {
								// Múltiplos resultados de série
								await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
									candidates: tvResults.slice(0, 5),
									detected_type: 'tv_show',
								});

								const options = tvResults
									.slice(0, 5)
									.map((s, i) => `${i + 1}. ${s.name} (${s.first_air_date?.split('-')[0]})`)
									.join('\n');

								responseText = `Achei estas séries:\n\n${options}\n\nQual delas?`;
							}
						} else {
							responseText = `Não achei "${intent.query}" nem como filme nem como série 🤔 Tenta com outro nome?`;
						}
					} else if (results.length === 1) {
						const movie = results[0];
						const metadata = await enrichmentService.enrich('movie', { tmdbId: movie.id });

						// Verifica duplicata antes de salvar
						const saveResult = await itemService.createItem({
							userId: user.id,
							type: 'movie',
							title: movie.title,
							metadata: metadata || undefined,
						});

						if (saveResult.isDuplicate) {
							responseText = `⚠️ Você já tem "${movie.title}" salvo! Foi em ${new Date(
								saveResult.existingItem?.createdAt || ''
							).toLocaleDateString('pt-BR')}.`;
						} else {
							responseText = `✅ Pronto! Salvei "${movie.title}" (${movie.release_date?.split('-')[0]}) 🎬`;
						}
						// Limpa contexto após salvar
						await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
					} else {
						// Múltiplos resultados
						await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
							candidates: results.slice(0, 5),
							detected_type: 'movie',
						});

						const options = results
							.slice(0, 5)
							.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
							.join('\n');

						responseText = `Achei alguns filmes com esse nome:\n\n${options}\n\nQual deles?`;
					}
					break;
				}

				case 'search_tv_show': {
					if (!intent.query) {
						responseText = 'Qual série você quer salvar?';
						break;
					}

					// Verifica se há múltiplos títulos separados por vírgula
					const titles = intent.query
						.split(',')
						.map((t) => t.trim())
						.filter((t) => t.length > 0);

					if (titles.length > 1) {
						// Processar múltiplas séries
						console.log(`📺 Processando ${titles.length} séries: ${titles.join(', ')}`);
						const savedShows: string[] = [];
						const notFoundShows: string[] = [];

						for (const title of titles) {
							const results = await enrichmentService.searchTVShows(title);

							if (results.length > 0) {
								const show = results[0]; // Pega o primeiro resultado
								const metadata = await enrichmentService.enrich('tv_show', { tmdbId: show.id });

								const saveResult = await itemService.createItem({
									userId: user.id,
									type: 'tv_show',
									title: show.name,
									metadata: metadata || undefined,
								});

								if (!saveResult.isDuplicate) {
									savedShows.push(`${show.name} (${show.first_air_date?.split('-')[0]})`);
								}
							} else {
								notFoundShows.push(title);
							}
						}

						// Monta resposta
						let response = '';
						if (savedShows.length > 0) {
							response += `✅ Salvei: ${savedShows.join(', ')}`;
						}
						if (notFoundShows.length > 0) {
							response +=
								savedShows.length > 0
									? `\n\n⚠️ Não achei: ${notFoundShows.join(', ')}`
									: `⚠️ Não achei nenhuma dessas séries: ${notFoundShows.join(', ')}`;
						}

						responseText = response || 'Hmm, tive problemas ao salvar essas séries 🤔';
						break;
					}

					// Fluxo normal para uma única série
					const results = await enrichmentService.searchTVShows(intent.query);

					if (results.length === 0) {
						// Tenta buscar como filme automaticamente
						console.log(`🔄 Não achei "${intent.query}" como série, tentando como filme...`);
						const movieResults = await enrichmentService.searchMovies(intent.query);

						if (movieResults.length > 0) {
							// Encontrou como filme! Oferece automaticamente
							await provider.sendMessage(incomingMsg.externalId, `Não achei como série, mas achei como filme! 🎬`);

							if (movieResults.length === 1) {
								const movie = movieResults[0];
								const metadata = await enrichmentService.enrich('movie', { tmdbId: movie.id });

								const saveResult = await itemService.createItem({
									userId: user.id,
									type: 'movie',
									title: movie.title,
									metadata: metadata || undefined,
								});

								if (saveResult.isDuplicate) {
									responseText = `⚠️ Você já tem "${movie.title}" salvo!`;
								} else {
									responseText = `✅ Salvei "${movie.title}" (${movie.release_date?.split('-')[0]}) 🎬`;
								}
								await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
							} else {
								// Múltiplos resultados de filme
								await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
									candidates: movieResults.slice(0, 5),
									detected_type: 'movie',
								});

								const options = movieResults
									.slice(0, 5)
									.map((m, i) => `${i + 1}. ${m.title} (${m.release_date?.split('-')[0]})`)
									.join('\n');

								responseText = `Achei estes filmes:\n\n${options}\n\nQual deles?`;
							}
						} else {
							responseText = `Não achei "${intent.query}" nem como série nem como filme 🤔 Tenta com outro nome?`;
						}
					} else if (results.length === 1) {
						const show = results[0];
						const metadata = await enrichmentService.enrich('tv_show', { tmdbId: show.id });

						// Verifica duplicata antes de salvar
						const saveResult = await itemService.createItem({
							userId: user.id,
							type: 'tv_show',
							title: show.name,
							metadata: metadata || undefined,
						});

						if (saveResult.isDuplicate) {
							responseText = `⚠️ Você já tem "${show.name}" salvo! Foi em ${new Date(
								saveResult.existingItem?.createdAt || ''
							).toLocaleDateString('pt-BR')}.`;
						} else {
							responseText = `✅ Pronto! Salvei "${show.name}" (${show.first_air_date?.split('-')[0]}) 📺`;
						}
						// Limpa contexto após salvar
						await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
					} else {
						// Múltiplos resultados
						await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
							candidates: results.slice(0, 5),
							detected_type: 'tv_show',
						});

						const options = results
							.slice(0, 5)
							.map((s, i) => `${i + 1}. ${s.name} (${s.first_air_date?.split('-')[0]})`)
							.join('\n');

						responseText = `Achei algumas séries com esse nome:\n\n${options}\n\nQual delas?`;
					}
					break;
				}

				case 'list_items': {
					if (userItems.length === 0) {
						responseText = 'Você ainda não salvou nada! 📭\n\nMe manda um filme, série ou link que eu guardo pra você.';
					} else {
						// Agrupa por tipo
						const byType: Record<string, typeof userItems> = {};
						userItems.forEach((item) => {
							if (!byType[item.type]) byType[item.type] = [];
							byType[item.type].push(item);
						});

						const typeLabels: Record<string, string> = {
							movie: '🎬 Filmes',
							tv_show: '📺 Séries',
							video: '🎥 Vídeos',
							link: '🔗 Links',
							note: '📝 Notas',
						};

						responseText = '📚 Aqui tá sua coleção:\n\n';
						for (const [type, items] of Object.entries(byType)) {
							responseText += `${typeLabels[type] || type}:\n`;
							items.slice(0, 10).forEach((item) => {
								const year = (item.metadata as any)?.year || (item.metadata as any)?.first_air_date || '';
								responseText += `  • ${item.title}${year ? ` (${year})` : ''}\n`;
							});
							if (items.length > 10) responseText += `  ... e mais ${items.length - 10}\n`;
							responseText += '\n';
						}
						responseText += `Total: ${userItems.length} item(s) 🎉`;
					}
					break;
				}

				case 'cancel': {
					responseText = 'Beleza, cancelado! 👍';
					await conversationService.updateState(conversation.id, 'idle', {});
					break;
				}

				case 'save_note': {
					const noteContent = intent.query || messageText;
					await itemService.createItem({
						userId: user.id,
						type: 'note',
						title: noteContent.slice(0, 100), // Limita título
						metadata: {
							full_content: noteContent,
							created_via: 'chat',
						},
					});
					responseText = `✅ Anotado: "${noteContent.slice(0, 50)}${noteContent.length > 50 ? '...' : ''}"`;
					// Limpa contexto após salvar
					await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
					break;
				}

				case 'set_assistant_name': {
					const newName = (intent as any).assistant_name || intent.query;
					if (newName) {
						await userService.updateAssistantName(user.id, newName);
						responseText = `Pronto! Agora pode me chamar de ${newName} 😊`;
					} else {
						responseText = 'Qual nome você gostaria de me dar?';
					}
					break;
				}

				default: {
					// Chat normal (LLM), com histórico + amostra da biblioteca do usuário
					const chatHistory = (await conversationService.getHistory(conversation.id, 12)).filter((m) => !isInternalMarker(m.content));
					const chatSystemPrompt = `Você é ${assistantName}, um assistente de memória pessoal.

Regras de conversa:
- Responda sempre em pt-BR.
- Não reinicie a conversa nem fique repetindo "Como posso ajudar?" a cada mensagem.
- Para confirmações curtas ("ta", "ok", "beleza", "legal", risadas), responda com uma confirmação curta e, no máximo, uma pergunta objetiva.
- Se o usuário pedir a lista, responda pedindo para ele mandar "lista" (ou trate como intenção list_items quando o roteador acertar).
- Seja natural e direto.

Você pode usar este contexto como referência (não cite literalmente):\n${buildLibrarySnapshot()}`;

					const chatResponse = await llmService.callLLM({
						message: messageText,
						history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
						systemPrompt: chatSystemPrompt,
					});

					responseText = chatResponse.message?.trim() || 'Fechou. Quer salvar algo ou ver sua lista?';
				}
			}
		} catch (error) {
			console.error('❌ Erro ao processar:', error);
			responseText = 'Opa, tive um probleminha aqui 😅 Tenta de novo?';
		}

		// 9. Salva resposta do bot
		await conversationService.addMessage(conversation.id, 'assistant', responseText);
	} catch (error) {
		// Erro crítico durante processamento - responde com mensagem genérica
		console.error('❌ Erro crítico:', error);
		responseText =
			'😅 Opa, algo deu errado aqui meu brother! Mas já estou de volta. Me manda aí:\n\n🎬 Um filme pra salvar\n🎥 Vídeo do YouTube\n🔗 Link interessante\n📝 Ou qualquer coisa que queira organizar!';
	}

	// 10. Envia resposta via provider (sempre envia, mesmo com erro)
	console.log(`📤 Enviando: "${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}"`);

	try {
		await provider.sendMessage(incomingMsg.externalId, responseText);
		console.log('✅ Mensagem enviada');

		// WhatsApp-specific: mark as read
		if (provider.getProviderName() === 'whatsapp' && 'markAsRead' in provider) {
			await (provider as any).markAsRead(incomingMsg.messageId);
		}
	} catch (error: any) {
		console.error(`❌ Erro ao enviar via ${provider.getProviderName()}:`, error);

		// WhatsApp dev mode: números na lista permitida
		if (error.message?.includes('131030')) {
			console.warn(`⚠️ Número não está na lista permitida (dev mode)`);
			console.warn('Adicione em: https://developers.facebook.com/apps > WhatsApp > Configuration');
		}
		// Não falha o webhook, apenas loga o erro
	}
}

export const webhookRouter = new Elysia()
	/**
	 * POST /telegram - Recebe mensagens do Telegram (PADRÃO)
	 */
	.post(
		'/telegram',
		async ({ body, set }) => {
			try {
				// Verifica autenticidade
				if (!telegramAdapter.verifyWebhook({ body } as any)) {
					set.status = 403;
					return { error: 'Forbidden' };
				}

				// Parse mensagem
				const incomingMsg = telegramAdapter.parseIncomingMessage(body);

				if (incomingMsg) {
					await processMessage(incomingMsg, telegramAdapter);
				}

				return { ok: true }; // Telegram espera "ok: true"
			} catch (error) {
				console.error('Erro no webhook Telegram:', error);
				set.status = 500;
				return { error: 'Internal error' };
			}
		},
		{
			detail: {
				tags: ['Webhook'],
				summary: 'Webhook Telegram',
				description: 'Recebe e processa mensagens do Telegram Bot API',
			},
		}
	)

	/**
	 * POST /whatsapp - Recebe mensagens do WhatsApp
	 */
	.post(
		'/whatsapp',
		async ({ body, request, set }) => {
			try {
				// Verifica autenticidade
				const isValid = await whatsappAdapter.verifyWebhook({ body, headers: request.headers } as any);
				if (!isValid) {
					console.warn('⚠️ Webhook WhatsApp com signature inválida');
					set.status = 403;
					return { error: 'Forbidden' };
				}

				// Parse mensagem
				const incomingMsg = whatsappAdapter.parseIncomingMessage(body);

				if (incomingMsg) {
					await processMessage(incomingMsg, whatsappAdapter);
				}

				return { success: true };
			} catch (error) {
				console.error('Erro no webhook WhatsApp:', error);
				set.status = 500;
				return { error: 'Internal error' };
			}
		},
		{
			detail: {
				tags: ['Webhook'],
				summary: 'Webhook WhatsApp',
				description: 'Recebe e processa mensagens do WhatsApp Business API',
			},
		}
	)

	/**
	 * GET /whatsapp - Verificação do webhook WhatsApp
	 */
	.get(
		'/whatsapp',
		({ query, set }) => {
			const mode = query['hub.mode'];
			const token = query['hub.verify_token'];
			const challenge = query['hub.challenge'];

			if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
				console.log('✅ Webhook WhatsApp verificado com sucesso!');
				return challenge;
			}

			console.warn('⚠️ Falha na verificação do webhook WhatsApp');
			set.status = 403;
			return 'Forbidden';
		},
		{
			query: t.Object({
				'hub.mode': t.Optional(t.String({ description: 'Modo de verificação' })),
				'hub.verify_token': t.Optional(t.String({ description: 'Token de verificação' })),
				'hub.challenge': t.Optional(t.String({ description: 'Challenge string' })),
			}),
			detail: {
				tags: ['Webhook'],
				summary: 'Verificação WhatsApp',
				description: 'Endpoint de verificação do webhook WhatsApp (Meta)',
			},
		}
	);
