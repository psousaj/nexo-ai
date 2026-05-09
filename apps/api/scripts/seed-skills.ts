import { db } from '@/db';
import { agentSkills } from '@/db/schema/agent-skills';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// ==========================================================================
// 🔧 ADICIONE NOVAS SKILLS AQUI
// ==========================================================================
// Para adicionar uma nova skill built-in:
// 1. Adicione um novo objeto no array builtInSkills abaixo
// 2. Rode: pnpm db:seed:skills
//
// Campos:
// - name: identificador único (ex: "save_movie")
// - description: descrição curta do que a skill faz
// - triggers: palavras-chave que ativam a skill no contexto
// - content: instruções em Markdown para o LLM seguir
// ==========================================================================

interface BuiltInSkillDef {
	name: string;
	description: string;
	triggers: string[];
	content: string;
}

const builtInSkills: BuiltInSkillDef[] = [
	{
		name: 'save_movie',
		description: 'Como salvar filmes para o usuário assistir depois',
		triggers: ['filme', 'filmes', 'movie', 'movies', 'assistir', 'ver depois', 'salva', 'salvar'],
		content: `## Skill: Salvar Filme

Quando o usuário pedir para salvar um filme, SIGA ESTES PASSOS:

1. **Buscar no TMDB**
   Use \`search_movie_tmdb(query)\` com o nome do filme.
   Se não tiver certeza do nome, clarifique primeiro.

2. **Clarificar se ambíguo**
   Se a busca retornar múltiplos resultados, use \`clarify(question, choices)\` com as opções no array \`choices\`.
   Exemplo: clarify("Qual versão?", ["Evil Dead (1981)", "Evil Dead (2013)"])
   NUNCA liste as opções no texto da resposta — use sempre o parâmetro choices.

3. **Mostrar e Confirmar**
   Use \`display_content(title, description, imageUrl)\` para mostrar o poster.
   O Telegram adiciona os botões Sim/Não automaticamente.

4. **Salvar**
   Se confirmado, use \`save_memory()\` com content "Filme: {título} ({ano})", category "personal"

5. **Se negar**
   Volte ao passo 2 e ofereça outras opções com clarify().

⚠️ NUNCA invente informações. Busque no TMDB primeiro.
⚠️ NUNCA salve sem confirmar com o usuário.
⚠️ NUNCA liste opções no texto — use sempre o parâmetro choices do clarify().`,
	},
	{
		name: 'save_music',
		description: 'Como salvar músicas para o usuário ouvir depois',
		triggers: ['música', 'musica', 'músicas', 'music', 'song', 'ouvir', 'escuta', 'playlist'],
		content: `## Skill: Salvar Música

Quando o usuário pedir para salvar uma música, SIGA ESTES PASSOS:

1. **Buscar no Spotify**
   Use \`search_music(title, artist)\` com título e artista (se informado).

2. **Clarificar se ambíguo**
   Se múltiplos resultados, use \`clarify(question, choices)\` com as opções no array choices.
   NUNCA liste opções no texto.

3. **Mostrar e Confirmar**
   Use \`display_content(title, description, imageUrl)\` com capa do álbum.

4. **Salvar**
   Se confirmado, use \`save_memory()\` com content "Música: {título} - {artista}", category "personal"

⚠️ SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET precisam estar configurados.
⚠️ NUNCA salve sem confirmar.
⚠️ Use clarify sempre com choices — nunca no texto.`,
	},
	{
		name: 'save_book',
		description: 'Como salvar livros para o usuário ler depois',
		triggers: ['livro', 'livros', 'book', 'books', 'ler', 'leitura', 'biblioteca'],
		content: `## Skill: Salvar Livro

Quando o usuário pedir para salvar um livro, SIGA ESTES PASSOS:

1. **Buscar no Google Books**
   Use \`search_book(title, author)\` com o título e autor (se informado).

2. **Clarificar se ambíguo**
   Se múltiplos resultados, clarifique com \`clarify()\`.

3. **Mostrar e Confirmar**
   Use \`display_content(title, description, imageUrl)\` com capa do livro.

4. **Salvar**
   Se confirmado, use \`save_memory()\` com:
   - content: "Livro: {título} - {autor}"
   - category: "personal"

⚠️ GOOGLE_BOOKS_API_KEY precisa estar configurada.
⚠️ NUNCA salve sem confirmar com o usuário.`,
	},
	{
		name: 'save_link',
		description: 'Como salvar links e páginas web para o usuário',
		triggers: ['link', 'links', 'url', 'site', 'página', 'pagina', 'artigo', 'salva esse link'],
		content: `## Skill: Salvar Link

Quando o usuário pedir para salvar um link ou URL, SIGA ESTES PASSOS:

1. **Buscar Preview**
   Use \`get_link_preview(url)\` para obter título, descrição e imagem do link.
   Se o usuário não forneceu a URL, clarifique.

2. **Mostrar e Confirmar**
   Use \`display_content(title, description, imageUrl)\` com os dados do preview.

3. **Salvar**
   Se confirmado, use \`save_memory()\` com:
   - content: "Link: {título}"
   - category: "personal"

⚠️ Links não precisam de API key — o sistema faz fetch direto.
⚠️ NUNCA salve sem confirmar com o usuário.`,
	},
];

async function seedSkills() {
	console.log('📦 Verificando usuário do sistema...');

	let systemUser = await db.select().from(users).where(eq(users.id, SYSTEM_USER_ID)).limit(1);

	if (systemUser.length === 0) {
		console.log('👤 Criando usuário do sistema...');
		await db.insert(users).values({
			id: SYSTEM_USER_ID,
			name: 'System',
			email: 'system@nexo.ai',
		});
		console.log('✅ Usuário do sistema criado');
	} else {
		console.log('✅ Usuário do sistema já existe');
	}

	console.log('📦 Verificando skills existentes...');

	for (const skill of builtInSkills) {
		const existing = await db.select().from(agentSkills).where(eq(agentSkills.name, skill.name)).limit(1);

		if (existing.length > 0) {
			console.log(`🔄 Atualizando skill "${skill.name}"...`);
			await db
				.update(agentSkills)
				.set({
					description: skill.description,
					content: skill.content,
					triggers: skill.triggers,
					version: existing[0].version + 1,
				})
				.where(eq(agentSkills.name, skill.name));
			console.log(`✅ Skill "${skill.name}" atualizada`);
			continue;
		}

		console.log(`📝 Inserindo skill "${skill.name}"...`);
		await db.insert(agentSkills).values({
			userId: SYSTEM_USER_ID,
			name: skill.name,
			description: skill.description,
			content: skill.content,
			triggers: skill.triggers,
			enabled: true,
			isBuiltIn: true,
			version: 1,
		});
		console.log(`✅ Skill "${skill.name}" inserida`);
	}

	console.log('🎉 Todas as skills foram processadas!');
}

seedSkills()
	.catch((err) => {
		console.error('❌ Erro ao seedar skills:', err);
		process.exit(1);
	})
	.then(() => {
		process.exit(0);
	});
