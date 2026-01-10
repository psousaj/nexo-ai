import { Elysia, t } from "elysia";
import { userService } from "@/services/user-service";
import { conversationService } from "@/services/conversation-service";
import { classifierService } from "@/services/classifier-service";
import { enrichmentService } from "@/services/enrichment";
import { itemService } from "@/services/item-service";
import { llmService } from "@/services/ai";
import { ToolExecutor } from "@/services/ai/tool-executor";
import { env } from "@/config/env";
import type { ItemType } from "@/types";
import {
  whatsappAdapter,
  telegramAdapter,
  type MessagingProvider,
  type IncomingMessage,
} from "@/adapters/messaging";

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
async function processMessage(
  incomingMsg: IncomingMessage,
  provider: MessagingProvider
) {
  const messageText = incomingMsg.text;
  let responseText = "";

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

    // 1b. Verifica se usuário está em timeout
    if (await isUserInTimeout(user.id, incomingMsg.externalId)) {
      const timeoutUntil = user.timeoutUntil || new Date(userTimeouts.get(incomingMsg.externalId)!);
      const remainingMinutes = Math.ceil(
        (timeoutUntil.getTime() - Date.now()) / (60 * 1000)
      );
      
      console.log(`⏸️ Usuário em timeout (${remainingMinutes} min)`);
      // Não processa e não responde
      return;
    }

    // 2. Busca ou cria conversação
    const conversation = await conversationService.findOrCreateConversation(
      user.id
    );

    // 3. Salva mensagem do usuário
    await conversationService.addMessage(conversation.id, "user", messageText);

    // 4. Verifica contexto recente (últimos 5 minutos)
    const recentMessages = await conversationService.getRecentMessages(
      conversation.id,
      5
    );
    const hasRecentContext = recentMessages.length > 1; // Mais de 1 mensagem = tem contexto

    // 5. Se está aguardando confirmação de item em batch, processa
    if (conversation.state === "awaiting_batch_item") {
      const context = conversation.context as any;
      const selection = parseInt(messageText.trim());

      if (
        !isNaN(selection) &&
        context.batch_current_candidates &&
        context.batch_current_candidates[selection - 1]
      ) {
        const selected = context.batch_current_candidates[selection - 1];
        const currentItem = context.batch_queue[context.batch_current_index];

        // Salva o filme confirmado
        if (currentItem.type === "movie") {
          const metadata = await enrichmentService.enrich("movie", {
            tmdbId: selected.id,
          });

          await itemService.createItem({
            userId: user.id,
            type: "movie",
            title: selected.title,
            metadata: metadata || undefined,
          });

          // Marca item como confirmado
          context.batch_queue[context.batch_current_index].status = "confirmed";
          context.batch_confirmed_items = context.batch_confirmed_items || [];
          context.batch_confirmed_items.push({
            title: selected.title,
            year: selected.release_date?.split("-")[0],
          });

          responseText = `✅ ${selected.title} (${
            selected.release_date?.split("-")[0]
          }) salvo!\n\n`;
        }

        // Avança para o próximo item da fila
        context.batch_current_index++;

        // Verifica se ainda há itens pendentes
        const nextPendingIndex = context.batch_queue.findIndex(
          (item: any, idx: number) =>
            idx >= context.batch_current_index && item.status === "pending"
        );

        if (nextPendingIndex !== -1) {
          // Processa próximo item
          const nextItem = context.batch_queue[nextPendingIndex];
          context.batch_current_index = nextPendingIndex;
          nextItem.status = "processing";

          if (nextItem.type === "movie") {
            const results = await enrichmentService.searchMovies(
              nextItem.query
            );

            if (results.length === 1) {
              // Match único, salva direto e continua
              const movie = results[0];
              const metadata = await enrichmentService.enrich("movie", {
                tmdbId: movie.id,
              });

              await itemService.createItem({
                userId: user.id,
                type: "movie",
                title: movie.title,
                metadata: metadata || undefined,
              });

              nextItem.status = "confirmed";
              context.batch_confirmed_items.push({
                title: movie.title,
                year: movie.release_date?.split("-")[0],
              });

              responseText += `✅ ${movie.title} (${
                movie.release_date?.split("-")[0]
              }) salvo!\n\n`;

              // Continua processando recursivamente
              context.batch_current_index++;
              // TODO: processar próximos itens em loop
            } else if (results.length > 1) {
              // Múltiplos resultados, pede confirmação
              context.batch_current_candidates = results.slice(0, 3);

              const remaining = context.batch_queue.filter(
                (item: any) => item.status === "pending"
              ).length;
              const progress = `[${context.batch_current_index + 1}/${
                context.batch_queue.length
              }]`;

              const options = results
                .slice(0, 3)
                .map(
                  (m, i) =>
                    `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
                )
                .join("\n");

              responseText += `${progress} **${nextItem.query}**\n\nEncontrei:\n${options}\n\nQual você quer? (Digite o número)`;
              responseText +=
                remaining > 1
                  ? `\n\n📋 Ainda faltam ${remaining - 1} filme(s)`
                  : "";

              await conversationService.updateState(
                conversation.id,
                "awaiting_batch_item",
                context
              );
              await conversationService.addMessage(
                conversation.id,
                "assistant",
                responseText
              );
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

          await conversationService.updateState(conversation.id, "idle", {});
        }

        await conversationService.addMessage(
          conversation.id,
          "assistant",
          responseText
        );
        await provider.sendMessage(incomingMsg.externalId, responseText);
        return;
      } else {
        // Verifica se usuário quer cancelar/pular
        const cancelPhrases = /\b(não|nenhum|nenhuma|pular|pula|cancelar|não tá|não ta|nao ta|nao|skip|next|outro)\b/i;
        
        if (cancelPhrases.test(messageText.toLowerCase())) {
          const currentItem = context.batch_queue[context.batch_current_index];
          
          // Marca como pulado
          currentItem.status = "skipped";
          context.batch_current_index++;
          
          // Adiciona mensagem indicando reset de contexto
          await conversationService.addMessage(
            conversation.id,
            "assistant",
            `[Pulando "${currentItem.query}" - próximo item]`
          );
          
          responseText = `⏭️ Ok, pulando "${currentItem.query}"\n\n`;
          
          // Verifica se há próximo item
          const nextPendingIndex = context.batch_queue.findIndex(
            (item: any, idx: number) =>
              idx >= context.batch_current_index && item.status === "pending"
          );
          
          if (nextPendingIndex !== -1) {
            // Processa próximo
            const nextItem = context.batch_queue[nextPendingIndex];
            context.batch_current_index = nextPendingIndex;
            nextItem.status = "processing";
            
            if (nextItem.type === "movie") {
              const results = await enrichmentService.searchMovies(nextItem.query);
              
              if (results.length === 1) {
                const movie = results[0];
                const metadata = await enrichmentService.enrich("movie", {
                  tmdbId: movie.id,
                });
                
                await itemService.createItem({
                  userId: user.id,
                  type: "movie",
                  title: movie.title,
                  metadata: metadata || undefined,
                });
                
                nextItem.status = "confirmed";
                context.batch_confirmed_items = context.batch_confirmed_items || [];
                context.batch_confirmed_items.push({
                  title: movie.title,
                  year: movie.release_date?.split("-")[0],
                });
                
                responseText += `✅ ${movie.title} (${movie.release_date?.split("-")[0]}) salvo!\n\n`;
              } else if (results.length > 1) {
                context.batch_current_candidates = results.slice(0, 3);
                
                const remaining = context.batch_queue.filter(
                  (item: any) => item.status === "pending"
                ).length;
                const progress = `[${context.batch_current_index + 1}/${
                  context.batch_queue.length
                }]`;
                
                const options = results
                  .slice(0, 3)
                  .map(
                    (m, i) =>
                      `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
                  )
                  .join("\n");
                
                responseText += `${progress} **${nextItem.query}**\n\nEncontrei:\n${options}\n\nQual você quer? (número ou "pular")`;
                responseText += remaining > 1 ? `\n\n📋 Ainda faltam ${remaining - 1} filme(s)` : "";
              }
            }
            
            await conversationService.updateState(
              conversation.id,
              "awaiting_batch_item",
              context
            );
          } else {
            // Terminou a fila
            const totalConfirmed = context.batch_confirmed_items?.length || 0;
            responseText += `\n🎉 Pronto! ${totalConfirmed} filme(s) salvos`;
            if (totalConfirmed > 0) {
              responseText += ":\n";
              context.batch_confirmed_items?.forEach((item: any) => {
                responseText += `• ${item.title} (${item.year})\n`;
              });
            } else {
              responseText += ".";
            }
            
            await conversationService.updateState(conversation.id, "idle", {});
          }
          
          await conversationService.addMessage(
            conversation.id,
            "assistant",
            responseText
          );
          await provider.sendMessage(incomingMsg.externalId, responseText);
          return;
        }
        
        // Se não for cancelamento, pede pra escolher número
        const currentItem = context.batch_queue[context.batch_current_index];
        responseText = `Por favor, escolha uma das opções para "${currentItem.query}" (digite o número, ou "pular" se não encontrou).`;
        await conversationService.addMessage(
          conversation.id,
          "assistant",
          responseText
        );
        await provider.sendMessage(incomingMsg.externalId, responseText);
        return;
      }
    }

    // 5b. Se está aguardando confirmação simples, processa resposta
    if (conversation.state === "awaiting_confirmation") {
      const context = conversation.context as any;
      const selection = parseInt(messageText.trim());

      if (
        !isNaN(selection) &&
        context.candidates &&
        context.candidates[selection - 1]
      ) {
        const selected = context.candidates[selection - 1];

        if (context.detected_type === "movie") {
          const metadata = await enrichmentService.enrich("movie", {
            tmdbId: selected.id,
          });

          await itemService.createItem({
            userId: user.id,
            type: "movie",
            title: selected.title,
            metadata: metadata || undefined,
          });

          responseText = `✅ Salvo: ${selected.title} (${
            selected.release_date?.split("-")[0]
          })`;

          // Reseta estado
          await conversationService.updateState(conversation.id, "idle", {});
        }
      } else {
        // Verifica se usuário quer cancelar
        const cancelPhrases = /\b(não quero|nenhum|nenhuma|cancelar|desistir|deixa pra lá|esquece|não mais)\b/i;
        
        if (cancelPhrases.test(messageText.toLowerCase())) {
          responseText = "⏭️ Ok, cancelado. Me manda outra coisa quando quiser!";
          await conversationService.updateState(conversation.id, "idle", {});
          
          // Adiciona mensagem de reset para limpar contexto
          await conversationService.addMessage(
            conversation.id,
            "assistant",
            "[Contexto anterior encerrado - nova busca]"
          );
        } else {
          // Usa IA para interpretar resposta natural (ex: "o de 2014", "o primeiro", "o com DiCaprio")
          const candidatesList = context.candidates
            .map((c: any, i: number) => `${i + 1}. ${c.title} (${c.release_date?.split("-")[0]})`)
            .join("\n");
          
          try {
            const interpretResponse = await llmService.callLLM({
              message: `O usuário está escolhendo entre estas opções de filmes:
${candidatesList}

Resposta do usuário: "${messageText}"

TAREFA: Identifique qual(is) filme(s) o usuário está se referindo.

REGRAS:
- Se a resposta identifica EXATAMENTE UM filme → responda: SELECIONADO: [número]
- Se a resposta é ambígua (ex: "o de 2014" mas há 2 filmes de 2014) → responda: AMBIGUO: [números separados por vírgula] | MOTIVO: [explicação curta]
- Se não conseguir identificar → responda com uma mensagem apropriada indicando a confusão

Exemplos:
- "o primeiro" com lista de 3 filmes → SELECIONADO: 1
- "o de 2014" com 2 filmes de 2014 (opções 1 e 2) → AMBIGUO: 1,2 | MOTIVO: dois filmes são de 2014
- "o do Nolan" quando só 1 é do Nolan → SELECIONADO: [número correspondente]
- "qualquer um" → INDEFINIDO`,
              history: [],
              systemPrompt: "You interpret user responses about movie selection. Be precise and direct. Respond ONLY in the requested format. The MOTIVO field (if used) should be in Brazilian Portuguese.",
            });

            const response = interpretResponse.message.trim();
            console.log(`🧠 Interpretação da IA: ${response}`);

            if (response.startsWith("SELECIONADO:")) {
              const selectedNum = parseInt(response.replace("SELECIONADO:", "").trim());
              if (!isNaN(selectedNum) && context.candidates[selectedNum - 1]) {
                const selected = context.candidates[selectedNum - 1];
                
                const metadata = await enrichmentService.enrich("movie", {
                  tmdbId: selected.id,
                });

                await itemService.createItem({
                  userId: user.id,
                  type: "movie",
                  title: selected.title,
                  metadata: metadata || undefined,
                });

                responseText = `✅ Salvo: ${selected.title} (${selected.release_date?.split("-")[0]})`;
                await conversationService.updateState(conversation.id, "idle", {});
              } else {
                responseText = "Hmm, não entendi. Digite o número (1, 2 ou 3) ou 'cancelar'.";
              }
            } else if (response.startsWith("AMBIGUO:")) {
              // Extrai números e motivo
              const parts = response.replace("AMBIGUO:", "").split("|");
              const ambiguousNums = parts[0].trim().split(",").map(n => parseInt(n.trim()));
              const reason = parts[1]?.replace("MOTIVO:", "").trim() || "mais de uma opção corresponde";
              
              // Filtra candidatos ambíguos
              const ambiguousCandidates = ambiguousNums
                .filter(n => !isNaN(n) && context.candidates[n - 1])
                .map(n => {
                  const c = context.candidates[n - 1];
                  return `${n}. ${c.title} (${c.release_date?.split("-")[0]})`;
                });
              
              if (ambiguousCandidates.length > 1) {
                responseText = `🤔 Achei ${ambiguousCandidates.length} opções (${reason}):\n\n${ambiguousCandidates.join("\n")}\n\nQual deles? (digite o número)`;
              } else {
                responseText = "Hmm, não entendi. Digite o número (1, 2 ou 3) ou 'cancelar'.";
              }
            } else {
              responseText = "Hmm, não entendi. Digite o número (1, 2 ou 3) ou 'cancelar'.";
            }
          } catch (error) {
            console.error("Erro ao interpretar resposta:", error);
            responseText = "Hmm, não entendi. Digite o número (1, 2 ou 3) ou 'cancelar'.";
          }
        }
      }

      // Salva e envia resposta
      await conversationService.addMessage(
        conversation.id,
        "assistant",
        responseText
      );
      await provider.sendMessage(incomingMsg.externalId, responseText);
      return;
    }

    // 6. Classifica tipo de conteúdo
    let detectedType = classifierService.detectType(messageText);
    let processedMessage = messageText;

    // 6.0 DETECTA COMANDOS DE LISTAGEM/CONSULTA (antes de qualquer outra coisa)
    const listCommands = /^(listar|mostrar|ver|meus|minhas|o que (eu )?(tenho|salvei)|quais?|lista)/i;
    const isListCommand = listCommands.test(messageText.trim());
    
    if (isListCommand) {
      console.log("📋 Comando de listagem detectado");
      
      // Busca itens do usuário
      const userItems = await itemService.getUserItems(user.id, undefined, undefined, 10);
      
      if (userItems.length === 0) {
        responseText = "Você ainda não salvou nada! 📭\n\nMe manda um filme, série, vídeo ou link que eu guardo pra você.";
      } else {
        responseText = "📚 Aqui tá o que você tem salvo:\n\n";
        
        // Agrupa por tipo
        const byType: Record<string, typeof userItems> = {};
        userItems.forEach(item => {
          if (!byType[item.type]) byType[item.type] = [];
          byType[item.type].push(item);
        });
        
        const typeLabels: Record<string, string> = {
          movie: "🎬 Filmes",
          tv_show: "📺 Séries",
          video: "🎥 Vídeos",
          link: "🔗 Links",
          note: "📝 Notas",
        };
        
        for (const [type, items] of Object.entries(byType)) {
          responseText += `${typeLabels[type] || type}:\n`;
          items.forEach(item => {
            const year = (item.metadata as any)?.year || (item.metadata as any)?.first_air_date || "";
            responseText += `  • ${item.title}${year ? ` (${year})` : ""}\n`;
          });
          responseText += "\n";
        }
        
        responseText += `Total: ${userItems.length} item(s) 🎉`;
      }
      
      await conversationService.addMessage(conversation.id, "assistant", responseText);
      await provider.sendMessage(incomingMsg.externalId, responseText);
      return;
    }

    // 6.1 DETECTA MÚLTIPLOS ITENS (lista)
    const multipleItems = classifierService.detectMultipleItems(messageText);

    if (multipleItems && multipleItems.length >= 2) {
      // Detectou lista! Inicia processamento em batch
      const batchQueue: Array<{
        query: string;
        type: ItemType;
        status: "pending" | "processing" | "confirmed" | "skipped";
      }> = multipleItems.map((item) => ({
        query: item,
        type: (classifierService.detectType(item) || "movie") as ItemType,
        status: "pending",
      }));

      responseText = `📋 Detectei ${multipleItems.length} itens! Vamos processar:\n`;
      multipleItems.forEach((item, i) => {
        responseText += `${i + 1}. ${item}\n`;
      });
      responseText += `\n⏳ Buscando informações...`;

      // Envia mensagem inicial
      await conversationService.addMessage(
        conversation.id,
        "assistant",
        responseText
      );
      await provider.sendMessage(incomingMsg.externalId, responseText);

      // Inicia processamento do primeiro item
      const firstItem = batchQueue[0];
      firstItem.status = "processing";

      if (firstItem.type === "movie") {
        const results = await enrichmentService.searchMovies(firstItem.query);

        if (results.length === 1) {
          // Match único, salva direto
          const movie = results[0];
          const metadata = await enrichmentService.enrich("movie", {
            tmdbId: movie.id,
          });

          await itemService.createItem({
            userId: user.id,
            type: "movie",
            title: movie.title,
            metadata: metadata || undefined,
          });

          firstItem.status = "confirmed";
          responseText = `✅ [1/${batchQueue.length}] ${movie.title} (${
            movie.release_date?.split("-")[0]
          }) salvo!\n\n`;

          // TODO: Continuar processando próximos itens
          // Por enquanto, continua no próximo ciclo de mensagem
        } else if (results.length > 1) {
          // Múltiplos resultados, pede confirmação
          await conversationService.updateState(
            conversation.id,
            "awaiting_batch_item",
            {
              batch_queue: batchQueue,
              batch_current_index: 0,
              batch_current_candidates: results.slice(0, 3),
              batch_confirmed_items: [],
            }
          );

          const options = results
            .slice(0, 3)
            .map(
              (m, i) =>
                `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
            )
            .join("\n");

          responseText = `[1/${batchQueue.length}] **${
            firstItem.query
          }**\n\nEncontrei:\n${options}\n\nQual você quer? (Digite o número)\n\n📋 Depois confirmo os outros ${
            batchQueue.length - 1
          } filmes`;

          await conversationService.addMessage(
            conversation.id,
            "assistant",
            responseText
          );
          await provider.sendMessage(incomingMsg.externalId, responseText);
          return;
        } else {
          // Não encontrou
          firstItem.status = "skipped";
          responseText = `❌ [1/${batchQueue.length}] Não encontrei "${firstItem.query}"\n\n`;
        }
      }

      // Se chegou aqui sem retornar, continua processando próximos
      // (implementação simplificada - ideal seria loop recursivo)
      await conversationService.addMessage(
        conversation.id,
        "assistant",
        responseText
      );
      await provider.sendMessage(incomingMsg.externalId, responseText);
      return;
    }

    // 7. Se tem contexto recente E não detectou tipo claro, usa IA para analisar
    // MAS: NÃO analisa contexto se usuário acabou de cancelar (última mensagem foi reset)
    const lastBotMessage = recentMessages
      .filter((m) => m.role === "assistant")
      .pop();
    const justCanceled = lastBotMessage?.content.includes("[Contexto anterior encerrado") || 
                         lastBotMessage?.content.includes("[Pulando ") ||
                         lastBotMessage?.content.includes("cancelado");
    
    if (
      hasRecentContext &&
      !justCanceled &&
      detectedType === "note" &&
      !classifierService.extractUrl(messageText)
    ) {
      try {
        const history = await conversationService.getHistory(
          conversation.id,
          10
        );
        const contextAnalysis = await llmService.callLLM({
          message: `ANÁLISE DE CONTEXTO:

Histórico recente:
${history
  .slice(-6)
  .map((m) => `${m.role === "user" ? "Usuário" : "Bot"}: ${m.content}`)
  .join("\n")}

Nova mensagem: "${messageText}"

PERGUNTA: Esta nova mensagem é:
A) Um REFINAMENTO/COMPLEMENTO da mensagem anterior (adiciona contexto, especifica detalhes como ano, ator, etc)
B) Uma NOVA SOLICITAÇÃO independente (novo título de filme/conteúdo)

IMPORTANTE: Se for nova solicitação, responda "NOVA_SOLICITACAO" e pronto.
Se for refinamento, responda no formato:
REFINAMENTO
TITULO: [título limpo do filme/conteúdo, apenas o nome]

Exemplos:
- Mensagem "o de 1999" após "clube da luta" → REFINAMENTO / TITULO: Clube da Luta 1999
- Mensagem "Interestelar" após cancelar → NOVA_SOLICITACAO
- Mensagem "Interestelar, 2014" → NOVA_SOLICITACAO (é um título completo)`,
          history: [],
          systemPrompt:
            "You extract movie titles. Respond ONLY in the requested format. NEVER include explanations, analysis, or context - just the clean title.",
        });

        const isRefinement = contextAnalysis.message
          .toUpperCase()
          .includes("REFINAMENTO");

        if (isRefinement) {
          // Extrai título limpo - procura pelo formato TITULO: xxx
          const titleMatch = contextAnalysis.message.match(/TITULO:\s*(.+)/i);
          if (titleMatch) {
            const extractedTitle = titleMatch[1].trim()
              // Remove aspas, colchetes e outros caracteres extras
              .replace(/^["'\[\]]+|["'\[\]]+$/g, '')
              .trim();
            
            // Valida que é um título válido (não é uma explicação)
            if (extractedTitle.length > 0 && extractedTitle.length < 100 && 
                !extractedTitle.toLowerCase().includes("usuário") &&
                !extractedTitle.toLowerCase().includes("anteriormente")) {
              processedMessage = extractedTitle;
              // Reclassifica com o contexto combinado
              detectedType = classifierService.detectType(processedMessage);
              console.log(`🔄 Refinamento detectado: "${processedMessage}"`);
            }
          }
        } else {
          // Nova solicitação: usa a mensagem original sem modificações
          console.log(`🆕 Nova solicitação detectada: "${messageText}"`);
        }
      } catch (error) {
        console.error("Erro ao analisar contexto:", error);
        // Se falhar análise, continua com detecção normal
      }
    }

    // 7.5. Fallback: se detectou "note" mas mensagem parece título de filme (curta, simples)
    if (detectedType === "note" && !classifierService.extractUrl(processedMessage)) {
      const words = processedMessage.trim().split(/\s+/);
      const hasYear = /\b(19|20)\d{2}\b/.test(processedMessage);
      
      // Lista de palavras que NÃO são títulos de filmes
      const nonMovieWords = /^(oi|olá|ola|hey|ei|e aí|eai|obrigad[oa]|valeu|ok|beleza|sim|não|nao|cancelar|pular|listar|mostrar|ver|meus|minhas|ajuda|help)$/i;
      
      // Se mensagem tem 1-5 palavras E possivelmente um ano, E não é comando comum, assume filme
      if ((words.length <= 5 || hasYear) && !nonMovieWords.test(processedMessage.trim())) {
        console.log("🎬 Fallback: mensagem curta detectada como filme");
        detectedType = "movie";
      }
    }

    // 8. Processa baseado no tipo detectado (agora com contexto)

    console.log(`🔍 Tipo detectado: ${detectedType}`);
    console.log(`📝 Mensagem processada: "${processedMessage.substring(0, 100)}"`);

    if (detectedType === "movie") {
      // Extrai query - prefere processedMessage se foi refinada, senão usa messageText original
      let query = classifierService.extractQuery(processedMessage, "movie");
      
      // Validação extra: se a query ainda parece uma análise de contexto, usa mensagem original
      if (query.length > 80 || 
          query.toLowerCase().includes("usuário") ||
          query.toLowerCase().includes("anteriormente") ||
          query.toLowerCase().includes("sugerindo")) {
        console.warn("⚠️ Query inválida detectada, usando mensagem original");
        query = classifierService.extractQuery(messageText, "movie");
      }
      
      console.log(`🔎 Buscando filme: "${query}"`);
      const results = await enrichmentService.searchMovies(query);

      if (results.length === 0) {
        responseText = `Não encontrei nenhum filme com "${query}". Pode tentar com outro nome?`;
      } else if (results.length === 1) {
        // Salva direto
        const movie = results[0];
        const metadata = await enrichmentService.enrich("movie", {
          tmdbId: movie.id,
        });

        await itemService.createItem({
          userId: user.id,
          type: "movie",
          title: movie.title,
          metadata: metadata || undefined,
        });

        responseText = `✅ Salvo: ${movie.title} (${
          movie.release_date?.split("-")[0]
        })`;
      } else {
        // Múltiplos resultados - pede confirmação
        await conversationService.updateState(
          conversation.id,
          "awaiting_confirmation",
          {
            candidates: results.slice(0, 3),
            detected_type: "movie",
          }
        );

        const options = results
          .slice(0, 3)
          .map(
            (m, i) => `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
          )
          .join("\n");

        responseText = `Encontrei vários filmes:\n\n${options}\n\nQual você quer salvar? (Digite o número)`;
      }
    } else if (detectedType === "video") {
      const url = classifierService.extractUrl(processedMessage);
      if (url) {
        const metadata = await enrichmentService.enrich("video", { url });

        await itemService.createItem({
          userId: user.id,
          type: "video",
          title:
            (metadata && "channel_name" in metadata
              ? metadata.channel_name
              : null) || "Vídeo",
          metadata: metadata || undefined,
        });

        responseText = `✅ Vídeo salvo!`;
      }
    } else if (detectedType === "link") {
      const url = classifierService.extractUrl(processedMessage);
      if (url) {
        const metadata = await enrichmentService.enrich("link", { url });

        await itemService.createItem({
          userId: user.id,
          type: "link",
          title:
            (metadata && "og_title" in metadata ? metadata.og_title : null) ||
            url,
          metadata: metadata || undefined,
        });

        responseText = `✅ Link salvo!`;
      }
    } else {
      // Nota ou mensagem genérica - usa AI
      console.log("🧠 Chamando IA...");
      
      try {
        // Se usuário acabou de cancelar, envia SEM histórico para evitar confusão
        const shouldIncludeHistory = !justCanceled;
        const history = shouldIncludeHistory 
          ? await conversationService.getHistory(conversation.id, 6)
          : [];
        
        if (!shouldIncludeHistory) {
          console.log("🔄 Enviando sem histórico (contexto foi cancelado)");
        }
        
        const aiResponse = await llmService.callLLM({
          message: messageText,
          history,
        });

        console.log("💬 Resposta da IA:", aiResponse.message.substring(0, 100));

        // Se a IA retornou tool_calls, processa antes de responder
        if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
          console.log(`🔧 Processando ${aiResponse.tool_calls.length} tool call(s)...`);
          
          const toolExecutor = new ToolExecutor({
            userId: user.id,
            externalId: incomingMsg.externalId,
            conversationId: conversation.id,
          });

          // Transforma o formato da IA para o formato do executor
          const toolCalls = aiResponse.tool_calls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }));

          const toolResults = await toolExecutor.executeCalls(toolCalls);
          
          console.log("✅ Tool calls executadas:", toolResults.length);
          
          // Log dos resultados
          for (const result of toolResults) {
            const output = JSON.parse(result.output);
            if (result.success && output.success) {
              console.log(`  ✅ ${result.tool_call_id}: ${result.output.substring(0, 80)}...`);
            } else {
              console.error(`  ❌ ${result.tool_call_id} falhou:`, output.error || output.message);
            }
          }
        }

        // Verifica se a IA retornou uma resposta válida
        if (
          !aiResponse ||
          !aiResponse.message ||
          aiResponse.message.trim() === ""
        ) {
          console.warn("⚠️ IA retornou resposta vazia");
          responseText =
            "😅 Opa, fiquei sem resposta aqui meu brother! Tenta de novo ou me manda um filme, vídeo ou link que eu organizo pra você!";
        } else {
          responseText = aiResponse.message;
        }
      } catch (error) {
        console.error("❌ Erro ao chamar AI:", error);
        responseText =
          "😅 Eita, dei um bug aqui meu brother! Mas não se preocupa, tenta de novo ou me manda algum conteúdo tipo:\n\n🎬 Nome de um filme\n🎥 Link do YouTube\n🔗 Qualquer link interessante";
      }
    }

    // 9. Salva resposta do bot
    await conversationService.addMessage(
      conversation.id,
      "assistant",
      responseText
    );
  } catch (error) {
    // Erro crítico durante processamento - responde com mensagem genérica
    console.error("❌ Erro crítico:", error);
    responseText =
      "😅 Opa, algo deu errado aqui meu brother! Mas já estou de volta. Me manda aí:\n\n🎬 Um filme pra salvar\n🎥 Vídeo do YouTube\n🔗 Link interessante\n📝 Ou qualquer coisa que queira organizar!";
  }

  // 10. Envia resposta via provider (sempre envia, mesmo com erro)
  console.log(`📤 Enviando: "${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}"`);  
  
  try {
    await provider.sendMessage(incomingMsg.externalId, responseText);
    console.log("✅ Mensagem enviada");

    // WhatsApp-specific: mark as read
    if (provider.getProviderName() === "whatsapp" && "markAsRead" in provider) {
      await (provider as any).markAsRead(incomingMsg.messageId);
    }
  } catch (error: any) {
    console.error(`❌ Erro ao enviar via ${provider.getProviderName()}:`, error);
    
    // WhatsApp dev mode: números na lista permitida
    if (error.message?.includes("131030")) {
      console.warn(`⚠️ Número não está na lista permitida (dev mode)`);
      console.warn("Adicione em: https://developers.facebook.com/apps > WhatsApp > Configuration");
    }
    // Não falha o webhook, apenas loga o erro
  }
}

export const webhookRouter = new Elysia({ prefix: "/webhook" })
  /**
   * POST /webhook/telegram - Recebe mensagens do Telegram (PADRÃO)
   */
  .post(
    "/telegram",
    async ({ body, request, set }) => {
      try {
        // Verifica autenticidade
        if (!telegramAdapter.verifyWebhook(request)) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        // Parse mensagem
        const incomingMsg = telegramAdapter.parseIncomingMessage(body);

        if (incomingMsg) {
          await processMessage(incomingMsg, telegramAdapter);
        }

        return { ok: true }; // Telegram espera "ok: true"
      } catch (error) {
        console.error("Erro no webhook Telegram:", error);
        set.status = 500;
        return { error: "Internal error" };
      }
    },
    {
      body: t.Any(),
      response: {
        200: t.Object({
          ok: t.Boolean(),
        }),
        403: t.Object({
          error: t.String(),
        }),
        500: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        tags: ["Webhook"],
        summary: "Recebe mensagens do Telegram (padrão)",
        description:
          "Webhook que recebe e processa mensagens do Telegram Bot API",
      },
    }
  )

  /**
   * POST /webhook/whatsapp - Recebe mensagens do WhatsApp
   */
  .post(
    "/whatsapp",
    async ({ body, request, set }) => {
      try {
        // Verifica autenticidade
        if (!whatsappAdapter.verifyWebhook(request)) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        // Parse mensagem
        const incomingMsg = whatsappAdapter.parseIncomingMessage(body);

        if (incomingMsg) {
          await processMessage(incomingMsg, whatsappAdapter);
        }

        return { success: true };
      } catch (error) {
        console.error("Erro no webhook WhatsApp:", error);
        set.status = 500;
        return { error: "Internal error" };
      }
    },
    {
      body: t.Any(),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
        403: t.Object({
          error: t.String(),
        }),
        500: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        tags: ["Webhook"],
        summary: "Recebe mensagens do WhatsApp",
        description:
          "Webhook que recebe e processa mensagens do WhatsApp Business API",
      },
    }
  )

  /**
   * GET /webhook/whatsapp - Verificação do webhook WhatsApp
   */
  .get(
    "/whatsapp",
    ({ query, set }) => {
      const mode = query["hub.mode"];
      const token = query["hub.verify_token"];
      const challenge = query["hub.challenge"];

      if (mode === "subscribe" && token === env.META_VERIFY_TOKEN) {
        console.log("✅ Webhook WhatsApp verificado com sucesso!");
        return challenge;
      }

      console.warn("⚠️ Falha na verificação do webhook WhatsApp");
      set.status = 403;
      return "Forbidden";
    },
    {
      query: t.Object({
        "hub.mode": t.Optional(t.String()),
        "hub.verify_token": t.Optional(t.String()),
        "hub.challenge": t.Optional(t.String()),
      }),
      detail: {
        tags: ["Webhook"],
        summary: "Verificação do webhook WhatsApp",
        description: "Endpoint usado pelo Meta para verificar o webhook",
      },
    }
  );
