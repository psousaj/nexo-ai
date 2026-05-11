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
   Use \`search_movie(query)\` com o nome do filme.

2. **Se resultado ÚNICO e óbvio** (ex: "Interestelar 2014 Nolan")
   PULE a clarificação. Vá direto para o passo 3.

	3. **Se múltiplos resultados**
   Use \`clarify(question, choices)\` com as opções no array \`choices\`.
   NUNCA liste opções no texto — use sempre choices.

4. **Confirmar com poster**
   Use \`send_confirm(imageUrl, title)\` para mostrar o poster com botões Sim/Não. O usuário clica Sim ou Não:

   - **Sim**: depois chame \`save_memory(content, category)\` para salvar
   - **Não**: volte ao passo 2 e ofereça outras opções

⚠️ ORDEM: search → clarify → send_confirm → save_memory(só se Sim). NUNCA salve antes do send_confirm.
⚠️ Se a ferramenta de busca falhar → tente search_web.`,
	},
	{
		name: 'save_music',
		description: 'Como salvar músicas para o usuário ouvir depois',
		triggers: ['música', 'musica', 'músicas', 'music', 'song', 'ouvir', 'escuta', 'playlist', 'álbum', 'album', 'banda', 'artista', 'cantor', 'cantora'],
		content: `## Skill: Salvar Música

Quando o usuário pedir para salvar uma música, SIGA ESTES PASSOS:

1. **Buscar no Spotify**
   Use \`search_music(title, artist)\` com título e artista (se informado).

2. **Se resultado ÚNICO** → PULE clarificação, vá direto ao passo 3.
   **Se múltiplos resultados** → use \`clarify(question, choices)\`.

3. **Mostrar e Confirmar (OBRIGATÓRIO)**
   SEMPRE mostre a capa com \`display_content(title, description, imageUrl)\`.
   NUNCA pule esta etapa.

4. **Salvar (só se confirmado)**
   Sim → \`save_memory(content, category)\`
   Não → volte ao passo 2.

⚠️ ORDEM: search → clarify → display → confirm → save. NUNCA salve antes do display_content.
⚠️ SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET precisam estar configurados.
⚠️ SEMPRE mostre a capa antes de salvar.
⚠️ Use clarify sempre com choices — nunca no texto.
⚠️ Se a busca falhar → tente search_web como fallback.`,
	},
	{
		name: 'save_book',
		description: 'Como salvar livros para o usuário ler depois',
		triggers: ['livro', 'livros', 'book', 'books', 'ler', 'leitura', 'biblioteca'],
		content: `## Skill: Salvar Livro

Quando o usuário pedir para salvar um livro, SIGA ESTES PASSOS:

1. **Buscar no Google Books**
   Use \`search_book(title, author)\` com título e autor (se informado).

2. **Se resultado ÚNICO** → PULE clarificação, vá direto ao passo 3.
   **Se múltiplos resultados** → use \`clarify(question, choices)\`.

3. **Mostrar e Confirmar (OBRIGATÓRIO)**
   SEMPRE mostre a capa com \`display_content(title, description, imageUrl)\`.
   NUNCA pule esta etapa.

4. **Salvar (só se confirmado)**
   Sim → \`save_memory(content, category)\`
   Não → volte ao passo 2.

⚠️ GOOGLE_BOOKS_API_KEY precisa estar configurada.
⚠️ SEMPRE mostre a capa antes de salvar.
⚠️ Se a busca falhar → tente search_web.`,
	},
	{
		name: 'save_link',
		description: 'Como salvar links e páginas web para o usuário',
		triggers: ['link', 'links', 'url', 'site', 'página', 'pagina', 'artigo', 'salva esse link'],
		content: `## Skill: Salvar Link

Quando o usuário pedir para salvar um link ou URL, SIGA ESTES PASSOS:

1. **Buscar Preview**
   Use \`get_link_preview(url)\` para obter título, descrição e imagem.
   Se não forneceu a URL, clarifique primeiro.

2. **Mostrar e Confirmar (OBRIGATÓRIO)**
   SEMPRE mostre o preview com \`display_content(title, description, imageUrl)\`.
   NUNCA pule esta etapa.

3. **Salvar (só se confirmado)**
   Sim → \`save_memory(content, category)\`
   Não → volte ao passo 1 ou pergunte qual link ele quer.

⚠️ Links não precisam de API key.
⚠️ SEMPRE mostre o preview antes de salvar.
⚠️ Se o preview falhar → pergunte título e descrição pro usuário.`,
	},
	{
		name: 'handle_voice',
		description: 'Como lidar com mensagens de áudio transcritas',
		triggers: ['[Áudio', 'Transcrição', '🎙️', 'mensagem de voz', 'audio'],
		content: `## Skill: Mensagem de Voz

Quando o usuário envia um áudio, o sistema transcreve automaticamente e mostra:
🎙️ *Transcrição:* {texto}

REGRAS:
1. A transcrição É a mensagem do usuário. Trate-a exatamente como se ele tivesse digitado.
2. Se a transcrição começar com "[Áudio não reconhecido]", peça educadamente para o usuário repetir em texto.
3. NÃO pergunte "você mandou um áudio?" — a transcrição já está no contexto.
4. Se a transcrição estiver confusa ou parecer incompleta, clarifique normalmente.
5. NUNCA ignore o conteúdo da transcrição — ela é a mensagem real do usuário.`,
	},
	{
		name: 'check_before_save',
		description: 'Verificar se o item já foi salvo antes de adicionar novamente',
		triggers: ['salva', 'salvar', 'guarda', 'lembra', 'adiciona', 'quero ver', 'assistir', 'ouvir', 'ler', 'livro', 'filme', 'música', 'musica', 'link', 'confirmar e salvar', 'confirma que é esse'],
		content: `## Skill: Verificar Antes de Salvar

Antes de chamar \`save_memory()\`, SEMPRE chame \`search_memories(query)\` primeiro com os termos relevantes (título, artista, etc.).

Se a memória já existir nos resultados:
- Informe o usuário: "Isso já está salvo!"
- NÃO salve novamente — evite duplicatas

Se não existir:
- Prosseguir com o fluxo normal de salvamento (send_confirm → save_memory)

⚠️ REGRA: search_memories SEMPRE antes de save_memory.`,
	},
	{
		name: 'check_watch_providers',
		description: 'Verificar onde assistir um filme/série nos streamings',
		triggers: ['onde assistir', 'onde posso assistir', 'qual streaming', 'streaming', 'netflix', 'prime', 'disney+', 'max', 'assistir online', 'tem onde', 'passa onde', 'em qual plataforma', 'em que streaming', 'como assistir', 'posso ver'],
		content: `## Skill: Onde Assistir

Quando o usuário perguntar onde assistir um filme ou série, SIGA ESTES PASSOS:

1. **Identificar o conteúdo**
   Se o usuário já mencionou o filme/série antes (está no contexto), use o tmdbId que você já tem.
   Se não, use \`search_movie(query)\` para encontrar.

2. **Buscar provedores**
   Use \`search_watch_providers(tmdbId, type)\` com o ID do TMDB e o tipo (movie ou tv).

3. **Responder**
   - Se houver flatrate (streaming incluso): liste os serviços com ícone "📺"
   - Se houver rent: liste com "💵"
   - Se houver buy: liste com "🛒"
   - Se não houver nada no Brasil: avise que não está disponível nos streamings brasileiros

⚠️ Use search_watch_providers APENAS com o tmdbId obtido de search_movie.`,
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
