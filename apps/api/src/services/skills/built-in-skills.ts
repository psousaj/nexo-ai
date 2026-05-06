/**
 * Built-in Skills (NEX-30)
 *
 * Skills pré-carregadas no sistema que o agente pode usar sem
 * precisar ser treinado pelo usuário.
 */

export interface SkillDefinition {
	name: string;
	description: string;
	content: string;
	triggers: string[];
}

export const BUILT_IN_SKILLS: SkillDefinition[] = [
	// ── Onboarding ──────────────────────────────────────────────────────────
	{
		name: 'onboarding',
		description: 'Fluxo de boas-vindas para novos usuários',
		triggers: ['primeira vez', 'novo usuário', 'começar', 'como funciona', 'o que você faz'],
		content: [
			'# Onboarding Skill',
			'',
			'## Objetivo',
			'Guiar o usuário novo pelos recursos principais do Nexo.',
			'',
			'## Steps',
			'1. Se apresentar brevemente (nome, capacidades)',
			'2. Perguntar o nome do usuário se não souber',
			'3. Explicar que pode salvar memórias, buscar itens, e conversar naturalmente',
			'4. Oferecer ajudar a salvar algo (filme, nota, link)',
			'5. Mencionar comandos úteis: /help, /voice, /profile',
			'',
			'## Pitfalls',
			'- Não sobrecarregar com informação — máximo 3 funcionalidades por vez',
			'- Não perguntar "posso ajudar em algo?" genericamente — ser específico',
			'- Se o usuário já usou o Nexo antes, pular onboarding',
			'',
			'## Verification',
			'- Usuário entendeu o propósito do Nexo?',
			'- Usuário realizou pelo menos uma ação (salvou algo ou fez pergunta)?',
		].join('\n'),
	},

	// ── Debugging Flow ──────────────────────────────────────────────────────
	{
		name: 'debugging-flow',
		description: 'Fluxo estruturado para diagnosticar problemas técnicos',
		triggers: ['debug', 'bug', 'erro', 'problema', 'não funciona', 'quebrado', 'debugging'],
		content: [
			'# Debugging Flow Skill',
			'',
			'## Objetivo',
			'Diagnosticar problemas técnicos de forma estruturada.',
			'',
			'## Steps',
			'1. **Reproduzir**: Perguntar passos exatos para reproduzir o erro',
			'2. **Isolar**: Identificar se é frontend, backend, infra, ou dependência',
			'3. **Logs**: Pedir logs relevantes (últimas linhas, stack trace)',
			'4. **Hipótese**: Formular uma hipótese clara sobre a causa',
			'5. **Validar**: Sugerir um teste mínimo para confirmar/refutar a hipótese',
			'6. **Resolver**: Propor a correção ou workaround',
			'',
			'## Pitfalls',
			'- Não pular para solução sem diagnóstico',
			'- Não sugerir "tenta reiniciar" como primeira opção',
			'- Verificar variáveis de ambiente e configuração antes do código',
			'',
			'## Verification',
			'- Hipótese foi confirmada ou refutada?',
			'- Solução proposta é a causa raiz ou sintoma?',
		].join('\n'),
	},

	// ── Daily Review ────────────────────────────────────────────────────────
	{
		name: 'daily-review',
		description: 'Revisão diária de atividades e memórias',
		triggers: ['resumo do dia', 'daily review', 'o que fiz hoje', 'review', 'retrospectiva'],
		content: [
			'# Daily Review Skill',
			'',
			'## Objetivo',
			'Fazer uma retrospectiva do dia do usuário baseada nos logs e memórias.',
			'',
			'## Steps',
			'1. Buscar daily log de hoje (via daily_log_search)',
			'2. Buscar memórias salvas hoje (via memory_search)',
			'3. Agrupar por categoria: tarefas, conversas, eventos, erros',
			'4. Apresentar resumo organizado com emojis',
			'5. Perguntar se quer salvar algo como memória ou nota',
			'',
			'## Pitfalls',
			'- Se não houver dados, não inventar — dizer que o dia está vazio',
			'- Manter tom positivo, mesmo se houver erros',
			'- Não fazer review de dias anteriores a menos que solicitado',
			'',
			'## Verification',
			'- Usuário recebeu um resumo útil?',
			'- Itens importantes não foram omitidos?',
		].join('\n'),
	},
];
