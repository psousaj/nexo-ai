import { Router, Request, Response } from 'express';
import { userService } from '@/services/user-service';
import { conversationService } from '@/services/conversation-service';
import { classifierService } from '@/services/classifier-service';
import { enrichmentService } from '@/services/enrichment';
import { itemService } from '@/services/item-service';
import { llmService } from '@/services/ai';
import { ToolExecutor } from '@/services/ai/tool-executor';
import { env } from '@/config/env';
import type { ItemType } from '@/types';
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

			// Monta lista de candidatos para o LLM
			const candidatesList = candidates
				.map((c: any, i: number) => {
					const title = c.title || c.name;
					const year = c.release_date?.split('-')[0] || c.first_air_date?.split('-')[0];
					return `${i + 1}. ${title} (${year})`;
				})
				.join('\n');

			try {
				const interpretResponse = await llmService.callLLM({
					message: `CONTEXT: User was asked to choose from this list:
${candidatesList}

USER'S MESSAGE: "${messageText}"

TASK: Analyze if the user is:
1. Selecting an option from the list
2. Canceling/giving up
3. Changing subject (asking something else, requesting a different movie/series)
4. Providing more details to clarify
5. Unclear response

Respond in JSON:
{
  "action": "select" | "ambiguous" | "cancel" | "change_subject" | "unclear",
  "selected": option number (if action=select),
  "options": [numbers] (if action=ambiguous),
  "new_intent": "search_movie" | "search_tv_show" | "chat" | null (only if action=change_subject),
  "new_query": "the new movie/series title" (only if action=change_subject and new_intent is search_*),
  "reason": "short explanation in Brazilian Portuguese",
  "response": "natural response to user in Brazilian Portuguese"
}

CRITICAL RULES:
- If user says something like "não, quero X" or "não é esse, é Y" → action: "change_subject", new_query: "Y"
- If user asks about something unrelated → action: "change_subject", new_intent: "chat"
- If user says "nenhum desses" or "não quero" without alternative → action: "cancel"
- If user mentions "não tá na lista" + gives more details → action: "change_subject" with clarified query
- ALWAYS cancel pending state when user changes subject

Examples:
- "o primeiro" → {"action":"select","selected":1}
- "não é esse, é o clube da luta de 1999" → {"action":"change_subject","new_intent":"search_movie","new_query":"Fight Club 1999"}
- "deixa pra lá, me fala das séries que eu tenho" → {"action":"change_subject","new_intent":"chat"}
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

							if (saveResult.isDuplicate) {
								responseText = `⚠️ Você já tem "${saveResult.existingItem?.title}" salvo! Foi em ${new Date(
									saveResult.existingItem?.createdAt || ''
								).toLocaleDateString('pt-BR')}.`;
							} else {
								responseText = `✅ Pronto! Salvei "${selected.title || selected.name}" (${year}) 🎬`;
							}

							await conversationService.updateState(conversation.id, 'idle', {});
							// Limpa contexto após salvar
							await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
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
						responseText = result.response || 'Beleza, cancelado! 👍';
						await conversationService.updateState(conversation.id, 'idle', {});
						// Marca no histórico que o contexto foi limpo (para o LLM saber)
						await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
						break;
					}

					case 'change_subject': {
						// Usuário mudou de assunto - cancela estado atual
						await conversationService.updateState(conversation.id, 'idle', {});
						await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');

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

			// Busca histórico recente para contexto conversacional
			const recentHistory = await conversationService.getHistory(conversation.id, 4);
			const lastAssistantMessage = recentHistory.filter((m) => m.role === 'assistant' && !m.content.startsWith('[')).pop();

			// Monta contexto de conversa (última pergunta do bot, se houver)
			const conversationContext = lastAssistantMessage ? `LAST BOT MESSAGE: "${lastAssistantMessage.content.substring(0, 200)}"` : '';

			// Monta contexto de nome para o LLM
			const nameContext = userFirstName
				? `USER NAME: "${userFirstName}" (use it occasionally in responses - ${
						isFirstInteraction ? 'MUST use in first greeting' : 'randomly, about 20% of the time'
				  })`
				: 'USER NAME: unknown (do not mention name)';

			// Nome do assistente (customizado pelo usuário ou padrão)
			const assistantName = user.assistantName || 'Nexo';
			const assistantContext = `ASSISTANT NAME: "${assistantName}" (this is YOUR name - use it if user asks your name)`;

			const intentPrompt = `${nameContext}
${assistantContext}
${conversationContext}

CURRENT MESSAGE TO ANALYZE: "${messageText}"

Analyze this message considering conversation context and respond in JSON:
{
  "intent": "search_movie" | "search_tv_show" | "list_items" | "save_note" | "set_assistant_name" | "chat" | "cancel",
  "query": "EXPANDED full ORIGINAL title (never abbreviations, never translated)",
  "assistant_name": "new name for assistant (only if intent=set_assistant_name)",
  "response": "your natural response to the user in Brazilian Portuguese"
}

INTENT RULES:
- "search_movie": user wants to save a MOVIE
- "search_tv_show": user wants to save a TV SERIES
- "list_items": user wants to see what they've already saved
- "save_note": user wants to save a reminder, task, or note
- "set_assistant_name": user is giving YOU (the assistant) a custom name
- "chat": casual conversation, questions, or greetings
- "cancel": user wants to cancel/give up on something

CONVERSATION CONTEXT:
- If the last bot message asked a QUESTION and user's response seems to answer it, interpret accordingly
- Example: Bot asked "Como quer me chamar?" and user says "Lúcio" → intent: set_assistant_name, assistant_name: "Lúcio"
- Example: Bot asked "Qual filme?" and user says "Matrix" → intent: search_movie, query: "The Matrix"

CRITICAL - ABBREVIATION EXPANSION (ALWAYS expand to ORIGINAL title):
- "hymim" or "HYMIM" → query: "How I Met Your Mother" (NOT "Como Conheci Sua Mãe")
- "tbbt" → query: "The Big Bang Theory"
- "got" → query: "Game of Thrones"
- "bb" or "breaking bad" → query: "Breaking Bad"
- "lotr" → query: "The Lord of the Rings"
- "sw" → query: "Star Wars"
- "hp" → query: "Harry Potter"
NEVER translate movie/series titles! Always use the ORIGINAL English title for search.

CRITICAL DISTINCTIONS:
- Task/reminder text → save_note
- Simple title/abbreviation → search_movie or search_tv_show
- Greeting or question → chat
- Single name after bot asked for name → set_assistant_name

The "response" must be natural, friendly, in Brazilian Portuguese.`;

			const intentResponse = await llmService.callLLM({
				message: intentPrompt,
				history: [], // NÃO passa histórico - cada mensagem é independente
				systemPrompt: `You are an intent classifier for a memory assistant.
Respond ONLY with valid JSON. No markdown, no explanations.

CRITICAL RULES:
1. ONLY analyze the CURRENT MESSAGE in the prompt - ignore any previous context
2. The "query" must come DIRECTLY from the current message, NEVER from history or saved items
3. If you don't recognize the current message as a title, try to expand abbreviations
4. NEVER substitute the user's input with something from their saved items

The "response" field MUST be in Brazilian Portuguese.`,
			});

			// Parse JSON da resposta
			let intent: { intent: string; query?: string; response: string };
			try {
				// Tenta extrair JSON da resposta (pode vir com markdown)
				const jsonMatch = intentResponse.message.match(/\{[\s\S]*\}/);
				if (!jsonMatch) throw new Error('No JSON found');
				intent = JSON.parse(jsonMatch[0]);
			} catch (e) {
				console.error('Erro ao parsear intent:', e);
				// Fallback: usa a resposta como chat
				intent = { intent: 'chat', response: intentResponse.message };
			}

			console.log(`🎯 Intent: ${intent.intent}, Query: ${intent.query || 'N/A'}`);

			// Executa ação baseada na intenção
			switch (intent.intent) {
				case 'search_movie': {
					if (!intent.query) {
						responseText = intent.response || 'Qual filme você quer salvar?';
						break;
					}

					const results = await enrichmentService.searchMovies(intent.query);

					if (results.length === 0) {
						responseText = `Não achei nenhum filme com "${intent.query}" 🤔 Tenta com outro nome?`;
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
						responseText = intent.response || 'Qual série você quer salvar?';
						break;
					}

					const results = await enrichmentService.searchTVShows(intent.query);

					if (results.length === 0) {
						responseText = `Não achei nenhuma série com "${intent.query}" 🤔 Tenta com outro nome?`;
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
					responseText = intent.response || 'Beleza, cancelado! 👍';
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
					responseText = intent.response || `✅ Anotado: "${noteContent.slice(0, 50)}${noteContent.length > 50 ? '...' : ''}"`;
					// Limpa contexto após salvar
					await conversationService.addMessage(conversation.id, 'assistant', '[CONTEXT_CLEARED]');
					break;
				}

				case 'set_assistant_name': {
					const newName = (intent as any).assistant_name || intent.query;
					if (newName) {
						await userService.updateAssistantName(user.id, newName);
						responseText = intent.response || `Pronto! Agora pode me chamar de ${newName} 😊`;
					} else {
						responseText = intent.response || 'Qual nome você gostaria de me dar?';
					}
					break;
				}

				default: {
					// Chat ou qualquer outra coisa
					responseText = intent.response || 'Posso te ajudar a salvar algum filme, série ou link?';
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

export const webhookRouter: Router = Router();

/**
 * POST /telegram - Recebe mensagens do Telegram (PADRÃO)
 */
webhookRouter.post('/telegram', async (req: Request, res: Response) => {
	try {
		// Verifica autenticidade
		if (!telegramAdapter.verifyWebhook(req)) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		// Parse mensagem
		const incomingMsg = telegramAdapter.parseIncomingMessage(req.body);

		if (incomingMsg) {
			await processMessage(incomingMsg, telegramAdapter);
		}

		return res.json({ ok: true }); // Telegram espera "ok: true"
	} catch (error) {
		console.error('Erro no webhook Telegram:', error);
		return res.status(500).json({ error: 'Internal error' });
	}
});

/**
 * POST /whatsapp - Recebe mensagens do WhatsApp
 */
webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
	try {
		// Verifica autenticidade
		const isValid = await whatsappAdapter.verifyWebhook(req);
		if (!isValid) {
			console.warn('⚠️ Webhook WhatsApp com signature inválida');
			return res.status(403).json({ error: 'Forbidden' });
		}

		// Parse mensagem
		const incomingMsg = whatsappAdapter.parseIncomingMessage(req.body);

		if (incomingMsg) {
			await processMessage(incomingMsg, whatsappAdapter);
		}

		return res.json({ success: true });
	} catch (error) {
		console.error('Erro no webhook WhatsApp:', error);
		return res.status(500).json({ error: 'Internal error' });
	}
});

/**
 * GET /whatsapp - Verificação do webhook WhatsApp
 */
webhookRouter.get('/whatsapp', (req: Request, res: Response) => {
	const mode = req.query['hub.mode'];
	const token = req.query['hub.verify_token'];
	const challenge = req.query['hub.challenge'];

	if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
		console.log('✅ Webhook WhatsApp verificado com sucesso!');
		return res.send(challenge);
	}

	console.warn('⚠️ Falha na verificação do webhook WhatsApp');
	return res.status(403).send('Forbidden');
});
