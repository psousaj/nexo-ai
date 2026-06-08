/**
 * Mensagens determinísticas do sistema (sem prompts de LLM).
 *
 * Regra arquitetural:
 * - Prompts de LLM vivem exclusivamente em YAML (config/prompts/*.yml)
 * - Este arquivo contém apenas mensagens estáticas e helpers de UX
 */

export const OFF_TOPIC_MESSAGES = [
	'Entendi! Parece que estamos fugindo um pouco do assunto 😄 Mas tá tudo bem! Quando quiser salvar algo ou ver sua lista, é só falar!',
	'Haha, adorei a conversa! Mas lembra que sou especialista em guardar memórias - filmes, séries, notas... Quando precisar, tô aqui! 📚',
	'Boa! Mas deixa eu me apresentar de novo: sou seu assistente de memória! Posso salvar filmes, séries e notas pra você. Vamos experimentar? 🎬',
	'Estou gostando do papo, mas sou melhor ajudando a organizar suas memórias! 😊 Filmes, séries, links... quando quiser guardar algo é só avisar.',
];

export const GENERIC_CONFIRMATION = 'Ok!';
export const CANCELLATION_PROMPT = 'Ok, cancelado.';
export const NO_ITEMS_FOUND = 'Nenhum item salvo ainda.';

export const ERROR_MESSAGES = [
	'⚠️ Ops, algo deu errado. Tenta de novo?',
	'😅 Deu um problema aqui. Pode tentar novamente?',
	'🤔 Hmm, algo não saiu como esperado. Tenta mais uma vez?',
	'⚡ Falha técnica! Tenta aí de novo.',
	'🔧 Tive um problema. Pode repetir?',
];

export const FALLBACK_MESSAGES = [
	'Ok! 👍',
	'Entendi! ✅',
	'Certo! 😊',
	'Anotado! 📝',
	'Beleza! 👌',
	'Show! ✨',
	'Fechou! 🤝',
	'Tranquilo! 😌',
];

export const CHOOSE_AGAIN_MESSAGES = [
	'🔄 Ok, vamos ver a lista novamente...',
	'🔍 Sem problemas! Veja as opções de novo:',
	'👀 Certo! Dá uma olhada de novo:',
	'🎬 Beleza! Aqui estão as opções novamente:',
	'📋 Tranquilo! Escolha outra opção:',
];

export const getRandomMessage = (messages: string[]): string => {
	return messages[Math.floor(Math.random() * messages.length)];
};

export const GENERIC_ERROR = getRandomMessage(ERROR_MESSAGES);

export const SAVE_SUCCESS = (title: string) => `✅ ${title} salvo!`;
export const ALREADY_SAVED_PROMPT = (title: string, type: string) => `📝 "${title}" já está salvo como ${type}!`;
export const TIMEOUT_MESSAGE = (minutes: number) =>
	`🚫 Por favor, mantenha uma comunicação respeitosa. Vou dar um tempo de ${minutes} minutos antes de continuar te ajudando.`;

export const getChannelLinkSuccessMessage = (provider: string): string => {
	switch (provider) {
		case 'telegram':
			return '✅ Conta vinculada com sucesso ao seu painel Nexo AI!\n\nFechado 🤝 A partir de agora, tudo que você mandar por aqui já vai direto para sua memória.';
		case 'whatsapp':
			return '✅ Conta vinculada com sucesso ao seu painel Nexo AI!\n\nPerfeito! Agora você pode me mandar links, vídeos, filmes e notas por aqui que eu organizo tudo pra você.';
		case 'discord':
			return '✅ Conta vinculada com sucesso ao seu painel Nexo AI!\n\nGG! Seu Discord já está conectado — pode enviar conteúdos neste canal que eu salvo na sua memória.';
		default:
			return '✅ Conta vinculada com sucesso ao seu painel Nexo AI!\n\nAgora você pode continuar usando normalmente por aqui.';
	}
};

export const getChannelStartNewUserMessage = (provider: string): string => {
	switch (provider) {
		case 'whatsapp':
			return 'Oi! 👋\n\nBem-vindo ao Nexo AI no WhatsApp.\n\nPode mandar links, vídeos, notas, filmes e séries que eu guardo tudo pra você.';
		default:
			return 'Olá! 😊\n\nBem-vindo ao Nexo AI, sua segunda memória inteligente.\n\nPara começar, basta me enviar qualquer mensagem!';
	}
};

export const getChannelNotRegisteredMessage = (provider: string, signupLink: string): string => {
	switch (provider) {
		case 'telegram':
			return `Olá! 👋\n\nPara usar o Nexo AI no Telegram, crie sua conta gratuitamente:\n\n🔗 ${signupLink}\n\nAssim que concluir o cadastro, seu Telegram será vinculado automaticamente! ✅`;
		case 'discord':
			return `Fala! 👋\n\nPara usar o Nexo AI no Discord, crie sua conta:\n\n🔗 ${signupLink}\n\nO canal será vinculado automaticamente ao finalizar o cadastro! ✅`;
		case 'whatsapp':
			return `Olá! 👋\n\nPara usar o Nexo AI pelo WhatsApp, crie sua conta gratuitamente no painel:\n\n🔗 ${signupLink}\n\nAssim que concluir o cadastro, este número será vinculado automaticamente! ✅`;
		default:
			return `Olá! 😊\n\nPara começar, crie sua conta:\n\n🔗 ${signupLink}\n\nApós o cadastro, este canal será vinculado automaticamente! ✅`;
	}
};

export const getChannelStartReturningMessage = (provider: string, dashboardUrl: string): string => {
	switch (provider) {
		case 'telegram':
			return `Bem-vindo de volta! 👋\n\nQuer vincular sua conta a outros dispositivos?\n\n1. Digite /vincular para gerar um código\n2. Ou abra seu painel: ${dashboardUrl}/profile`;
		case 'whatsapp':
			return `Que bom te ver de novo! 👋\n\nSe quiser unificar suas contas:\n\n1. Envie /vincular para gerar um código\n2. Ou acesse seu painel: ${dashboardUrl}/profile`;
		case 'discord':
			return `De volta ao jogo! 🎮\n\nPra vincular sua conta em outros dispositivos:\n\n1. Digite /vincular\n2. Ou use o painel: ${dashboardUrl}/profile`;
		default:
			return `Olá de volta! 😊\n\nSe você quer vincular sua conta para usar em outros dispositivos, você tem duas opções:\n\n1. Digite /vincular aqui agora para receber um código.\n2. Ou acesse seu painel: 🔗 ${dashboardUrl}/profile`;
	}
};

export const getChannelSignupRequiredMessage = (provider: string, signupLink: string): string => {
	switch (provider) {
		case 'whatsapp':
			return `Oi! 😊\n\nPara liberar tudo por aqui no WhatsApp, conclua seu cadastro rapidinho:\n\n🔗 ${signupLink}\n\nAssim que terminar, já pode me mandar conteúdo normalmente.`;
		case 'discord':
			return `Falta só um passo pra liberar tudo no Discord 🚀\n\nConclua seu cadastro aqui:\n\n🔗 ${signupLink}\n\nDepois é só voltar e mandar o que quiser salvar.`;
		default:
			return `Olá! 😊\n\nPara começar a usar o Nexo AI por aqui, você precisa concluir seu cadastro rápido no nosso painel:\n\n🔗 ${signupLink}\n\nÉ rapidinho e você já poderá salvar tudo o que quiser!`;
	}
};

export const getChannelTrialExceededMessage = (provider: string, signupLink: string): string => {
	switch (provider) {
		case 'whatsapp':
			return `🚀 Você chegou ao limite do trial gratuito no WhatsApp.\n\nPra continuar sem limite, finalize sua conta:\n\n🔗 ${signupLink}`;
		case 'discord':
			return `🚀 Seu trial no Discord chegou ao limite.\n\nPra continuar usando sem limite, conclua sua conta:\n\n🔗 ${signupLink}`;
		default:
			return `🚀 Você atingiu o limite de 10 mensagens do seu trial gratuito!\n\nPara continuar usando o Nexo AI e desbloquear recursos ilimitados, crie sua conta agora mesmo:\n\n🔗 ${signupLink}`;
	}
};

export const CASUAL_RESPONSES = {
	greetings: ['Oi! 👋', 'Olá! 👋', 'E aí! 👋', 'Opa! 👋'],
	thanks: ['Por nada! 😊', 'Disponha! 😊', 'Tmj! 🤝', 'Sempre! 😊'],
	farewell: ['Até logo! 👋', 'Falou! 👋', 'Até mais! 👋'],
	default: ['Oi! 👋', 'Olá! Como posso ajudar?'],
};

export const CASUAL_GREETINGS: Record<string, string> = {
	oi: 'Oi! 👋',
	olá: 'Olá! 👋',
	'e aí': 'E aí! 👋',
	opa: 'Opa! 👋',
	'tudo bem': 'Tudo ótimo! E você?',
	obrigado: 'Por nada! 😊',
	obrigada: 'Por nada! 😊',
	valeu: 'Tmj! 🤝',
	vlw: 'Tmj! 🤝',
	thanks: 'Sempre! 😊',
	tchau: 'Até logo! 👋',
	até: 'Até mais! 👋',
	flw: 'Falou! 👋',
};

export const formatItemsList = (items: Array<{ title: string; type: string }>, total: number) => {
	if (total === 0) {
		return NO_ITEMS_FOUND;
	}

	const itemsByType: Record<string, string[]> = {};

	items.forEach((item) => {
		const typeEmoji: Record<string, string> = {
			movie: '🎬',
			tv_show: '📺',
			video: '🎥',
			link: '🔗',
			note: '📝',
			memory: '🗒️',
			book: '📚',
			music: '🎵',
			image: '🖼️',
		};

		const emoji = typeEmoji[item.type] || '📌';
		const typeName: Record<string, string> = {
			movie: 'Filmes',
			tv_show: 'Séries',
			video: 'Vídeos',
			link: 'Links',
			note: 'Notas',
			memory: 'Memórias',
			book: 'Livros',
			music: 'Músicas',
			image: 'Imagens',
		};

		const type = typeName[item.type] || 'Outros';
		const title = item.title?.trim() || '(sem título)';

		if (!itemsByType[type]) {
			itemsByType[type] = [];
		}

		const itemNumber = itemsByType[type].length + 1;
		itemsByType[type].push(` ${itemNumber}. ${emoji} ${title}`);
	});

	let response = '📚 Aqui tá sua coleção:\n\n';

	Object.entries(itemsByType).forEach(([type, itemList]) => {
		const typeEmoji: Record<string, string> = {
			Filmes: '🎬',
			Séries: '📺',
			Vídeos: '🎥',
			Links: '🔗',
			Notas: '📝',
			Memórias: '🗒️',
			Livros: '📚',
			Músicas: '🎵',
			Imagens: '🖼️',
		};

		response += `${typeEmoji[type] || '📌'} ${type}:\n${itemList.join('\n')}\n\n`;
	});

	response += `Total: ${total} item(s)`;

	return response;
};
