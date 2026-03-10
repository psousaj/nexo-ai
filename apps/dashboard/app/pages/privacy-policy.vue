<script setup lang="ts">
definePageMeta({
	layout: false,
});

const lastUpdate = '10 de Março de 2026';
</script>

<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-white">
		<!-- Header -->
		<header class="sticky top-0 z-30 bg-white/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800">
			<div class="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
				<NuxtLink to="/" class="flex items-center gap-2 group">
					<div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-sm shadow-primary-600/30">
						<span class="text-white font-bold text-sm">N</span>
					</div>
					<span class="font-bold text-xl text-surface-900 dark:text-white group-hover:text-primary-600 transition-colors">
						Nexo<span class="text-primary-600">AI</span>
					</span>
				</NuxtLink>
				<NuxtLink
					to="/"
					class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-surface-600 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
				>
					← Voltar ao Dashboard
				</NuxtLink>
			</div>
		</header>

		<!-- Content -->
		<main class="max-w-4xl mx-auto px-6 py-12">
			<!-- Title Section -->
			<div class="mb-10">
				<p class="text-xs font-bold uppercase tracking-widest text-primary-600 mb-2">Legal</p>
				<h1 class="text-4xl font-black text-surface-900 dark:text-white mb-3">Política de Privacidade</h1>
				<p class="text-surface-500 dark:text-surface-400 text-lg">Saiba como coletamos, usamos e protegemos seus dados pessoais.</p>
				<div
					class="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-surface-100 dark:bg-surface-800 rounded-full text-sm text-surface-600 dark:text-surface-400"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
					<strong>Última atualização:</strong>&nbsp;{{ lastUpdate }}
				</div>
			</div>

			<!-- Intro -->
			<div class="prose-section mb-8">
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					O <strong>Nexo AI</strong>, na qualidade de Controlador de Dados nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018
					— "LGPD"), apresenta esta Política de Privacidade, que estabelece como são tratados os dados pessoais coletados por meio do
					assistente de mensagens <strong>Nexo AI</strong>, disponível via Telegram, WhatsApp e Discord.
				</p>
			</div>

			<!-- Divider -->
			<div class="border-t border-surface-200 dark:border-surface-800 mb-10" />

			<!-- Section 1 -->
			<section class="mb-10">
				<h2 class="section-title">1. Definições Importantes</h2>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li><strong>Dados Pessoais:</strong> Qualquer informação relacionada a pessoa natural identificada ou identificável.</li>
					<li><strong>Tratamento:</strong> Toda operação realizada com dados pessoais.</li>
					<li><strong>Titular:</strong> Pessoa natural a quem se referem os dados pessoais.</li>
					<li><strong>Controlador:</strong> Pessoa jurídica responsável pelas decisões referentes ao tratamento de dados pessoais.</li>
					<li><strong>Base Legal:</strong> Fundamento jurídico que autoriza o tratamento de dados pessoais.</li>
				</ul>
			</section>

			<!-- Section 2 -->
			<section class="mb-10">
				<h2 class="section-title">2. Bases Legais para o Tratamento</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					Realizamos o tratamento de dados pessoais com base nas seguintes hipóteses legais:
				</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li><strong>Consentimento:</strong> Quando você expressamente autoriza a coleta e o uso dos seus dados.</li>
					<li><strong>Execução de Contrato:</strong> Para prestação dos serviços solicitados por você.</li>
					<li><strong>Legítimo Interesse:</strong> Quando necessário para aprimorar nossos serviços e a experiência do usuário.</li>
					<li><strong>Cumprimento de Obrigação Legal:</strong> Para atender exigências legais e regulatórias.</li>
				</ul>
			</section>

			<!-- Section 3 -->
			<section class="mb-10">
				<h2 class="section-title">3. Dados Pessoais Coletados</h2>

				<h3 class="subsection-title">3.1 Dados fornecidos diretamente pelo usuário</h3>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300 mb-6">
					<li>Dados de identificação e contato (nome e e-mail)</li>
					<li>Conteúdos salvos intencionalmente: filmes, séries, vídeos, links e anotações</li>
					<li>Preferências de uso do assistente (nome do assistente, configurações de notificação)</li>
					<li>Mensagens enviadas ao assistente via Telegram, WhatsApp ou Discord</li>
				</ul>

				<h3 class="subsection-title">3.2 Dados coletados automaticamente</h3>
				<div class="space-y-4">
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Dados de Conta e Plataforma:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Identificadores externos das plataformas de mensagens (ID do Telegram, ID do WhatsApp, ID do Discord)</li>
							<li>Provedor de autenticação utilizado (Google OAuth, Discord OAuth)</li>
							<li>Data e hora das mensagens enviadas</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Dados de Uso:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Endereço IP de acesso ao dashboard web</li>
							<li>Registros de interação com o assistente (histórico de mensagens)</li>
							<li>Estado e contexto das conversas</li>
							<li>Metadados dos conteúdos salvos (títulos, descrições, URLs, pôsteres de filmes/séries)</li>
						</ul>
					</div>
				</div>
			</section>

			<!-- Section 4 -->
			<section class="mb-10">
				<h2 class="section-title">4. Finalidades do Tratamento</h2>
				<div class="space-y-4">
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Prestação dos Serviços:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Identificação e classificação de intenções nas mensagens do usuário</li>
							<li>Salvamento e organização de conteúdos via assistente de IA</li>
							<li>Busca semântica nos conteúdos salvos</li>
							<li>Enriquecimento de metadados via APIs externas (TMDB para filmes/séries, YouTube para vídeos)</li>
							<li>Gerenciamento do estado da conversa e contexto entre sessões</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Aprimoramento do Serviço:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Análise de padrões de uso para melhoria da classificação de intenções</li>
							<li>Desenvolvimento de novos recursos do assistente</li>
							<li>Geração de relatórios e análises estatísticas</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Segurança:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Proteção dos dados e dos direitos dos usuários</li>
							<li>Prevenção de uso indevido da plataforma</li>
							<li>Monitoramento de falhas e erros do sistema</li>
						</ul>
					</div>
				</div>
			</section>

			<!-- Section 5 -->
			<section class="mb-10">
				<h2 class="section-title">5. Compartilhamento de Dados</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					<strong>Não compartilhamos seus dados pessoais com terceiros para fins comerciais.</strong>
					Podemos compartilhar dados apenas nas seguintes situações:
				</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>
						<strong>Provedores de infraestrutura:</strong> Empresas que nos auxiliam na operação da plataforma (armazenamento em banco de
						dados, processamento de filas, serviços de IA), sempre mediante contratos que garantam a proteção dos dados.
					</li>
					<li>
						<strong>APIs de enriquecimento:</strong> TMDB (The Movie Database) e YouTube Data API para busca de metadados de filmes, séries
						e vídeos — apenas os termos de busca são compartilhados, nunca dados de identificação pessoal.
					</li>
					<li><strong>Obrigações legais:</strong> Quando exigido por autoridades competentes nos termos da legislação vigente.</li>
				</ul>
			</section>

			<!-- Section 6 -->
			<section class="mb-10">
				<h2 class="section-title">6. Medidas de Segurança</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					Implementamos medidas técnicas e organizacionais apropriadas para proteger os dados pessoais, incluindo:
				</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>Criptografia de dados em trânsito (HTTPS/TLS) e em repouso</li>
					<li>Controles de acesso rigorosos por função (CASL + Better Auth)</li>
					<li>Autenticação segura com provedores OAuth (Google, Discord)</li>
					<li>Monitoramento contínuo de erros e falhas de segurança</li>
					<li>Processamento assíncrono de mensagens via filas protegidas (Bull + Redis)</li>
					<li>Banco de dados gerenciado com backups automáticos (Supabase PostgreSQL)</li>
				</ul>
			</section>

			<!-- Section 7 -->
			<section class="mb-10">
				<h2 class="section-title">7. Direitos dos Titulares</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">Em conformidade com a LGPD, você possui os seguintes direitos:</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li><strong>Confirmação e Acesso:</strong> Saber se tratamos seus dados e acessá-los via dashboard.</li>
					<li><strong>Correção:</strong> Solicitar a correção de dados incorretos ou desatualizados.</li>
					<li><strong>Anonimização, Bloqueio ou Eliminação:</strong> Solicitar estas ações para dados desnecessários ou excessivos.</li>
					<li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado.</li>
					<li><strong>Eliminação:</strong> Solicitar a exclusão de dados tratados com base no consentimento.</li>
					<li><strong>Informação:</strong> Ser informado sobre o compartilhamento de seus dados.</li>
					<li><strong>Revogação do Consentimento:</strong> Retirar seu consentimento a qualquer momento.</li>
					<li><strong>Oposição:</strong> Contestar o tratamento realizado com base em outras hipóteses legais.</li>
				</ul>
			</section>

			<!-- Section 8 -->
			<section class="mb-10">
				<h2 class="section-title">8. Exclusão de Conta</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					Você pode solicitar a exclusão da sua conta a qualquer momento acessando o menu
					<strong>Perfil → Segurança</strong> no dashboard ou entrando em contato conosco pelo e-mail de suporte.
				</p>

				<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-4">
					<p class="font-bold text-amber-800 dark:text-amber-300 mb-2">⚠️ Importante</p>
					<p class="text-amber-700 dark:text-amber-400 text-sm">
						A exclusão da conta é uma ação permanente e irreversível. Ao excluir sua conta:
					</p>
				</div>

				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>Todos os seus dados pessoais serão removidos de nossos sistemas</li>
					<li>Todos os conteúdos salvos (filmes, séries, vídeos, links, notas) serão permanentemente apagados</li>
					<li>As vinculações com plataformas de mensagens (Telegram, WhatsApp, Discord) serão desfeitas</li>
					<li>O histórico de conversas e preferências será eliminado</li>
					<li>Não será possível recuperar a conta ou qualquer informação associada a ela posteriormente</li>
				</ul>
			</section>

			<!-- Section 9 -->
			<section class="mb-10">
				<h2 class="section-title">9. Período de Retenção</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">Mantemos seus dados pessoais pelo tempo necessário para:</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>Cumprir as finalidades para as quais foram coletados</li>
					<li>Atender obrigações legais e regulatórias</li>
					<li>Exercer direitos em processos judiciais ou administrativos</li>
				</ul>
				<p class="text-surface-700 dark:text-surface-300 mt-4">
					Após o período necessário, os dados serão excluídos ou anonimizados. O histórico de conversas inativas é automaticamente encerrado
					após período de inatividade determinado pelo sistema.
				</p>
			</section>

			<!-- Section 10 -->
			<section class="mb-10">
				<h2 class="section-title">10. Uso de Inteligência Artificial</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					O Nexo AI utiliza tecnologias de Inteligência Artificial para processar e organizar seus conteúdos. As aplicações de IA incluem:
				</p>
				<div class="space-y-4">
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Classificação de Intenções:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Análise determinística das mensagens para identificar a ação desejada pelo usuário</li>
							<li>Classificação entre: salvar conteúdo, buscar, deletar, atualizar, conversa casual, entre outras</li>
							<li>A IA analisa e planeja — o código controla a execução e o fluxo (arquitetura determinística)</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Busca Semântica:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Geração de vetores de embeddings (384 dimensões) para os conteúdos salvos</li>
							<li>Busca por similaridade semântica usando pgvector no banco de dados</li>
							<li>Os vetores são armazenados associados à sua conta e não são compartilhados</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-surface-800 dark:text-surface-200 mb-2">Enriquecimento de Conteúdo:</p>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300">
							<li>Consulta à API TMDB para obter metadados de filmes e séries (pôsteres, sinopses, avaliações)</li>
							<li>Consulta à YouTube Data API para obter detalhes de vídeos</li>
							<li>Scraping de metadados OpenGraph para links e páginas web</li>
						</ul>
					</div>
				</div>
				<p class="text-surface-700 dark:text-surface-300 mt-4">
					Os sistemas de IA são utilizados de forma ética e transparente, sempre respeitando sua privacidade e os princípios estabelecidos
					na LGPD.
				</p>
			</section>

			<!-- Section 11 -->
			<section class="mb-10">
				<h2 class="section-title">11. Integração com Plataformas de Mensagens</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-6">
					O Nexo AI opera como assistente nas plataformas de mensagens abaixo. Ao autorizar o bot, você permite que o assistente receba e
					processe suas mensagens para organizar seus conteúdos.
				</p>

				<div class="space-y-6">
					<!-- Telegram -->
					<div class="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-5">
						<h3 class="font-bold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
							<span class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-black">T</span>
							Telegram
						</h3>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300 text-sm">
							<li>Recebemos mensagens enviadas diretamente ao bot (@NexoAI) ou em grupos autorizados</li>
							<li>Coletamos: ID do usuário Telegram, nome de exibição e conteúdo das mensagens</li>
							<li>Você pode desvincular o Telegram a qualquer momento via <strong>Perfil → Contas conectadas</strong></li>
						</ul>
					</div>

					<!-- WhatsApp -->
					<div class="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-5">
						<h3 class="font-bold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
							<span class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-black">W</span>
							WhatsApp
						</h3>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300 text-sm">
							<li>Processamos mensagens recebidas via WhatsApp Business API (Meta) ou via conexão direta (Baileys)</li>
							<li>Coletamos: número de telefone (ID externo), nome e conteúdo das mensagens</li>
							<li>Você pode desvincular o WhatsApp a qualquer momento via <strong>Perfil → Contas conectadas</strong></li>
						</ul>
					</div>

					<!-- Discord -->
					<div class="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-5">
						<h3 class="font-bold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
							<span class="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-black">D</span>
							Discord
						</h3>
						<ul class="list-disc list-outside ml-5 space-y-1 text-surface-700 dark:text-surface-300 text-sm">
							<li>Processamos mensagens enviadas ao bot em servidores autorizados ou via DM</li>
							<li>Coletamos: ID do usuário Discord, nome de usuário e conteúdo das mensagens</li>
							<li>O Discord também pode ser usado como provedor de autenticação OAuth no dashboard</li>
							<li>Você pode desvincular o Discord a qualquer momento via <strong>Perfil → Contas conectadas</strong></li>
						</ul>
					</div>
				</div>
			</section>

			<!-- Section 12 -->
			<section class="mb-10">
				<h2 class="section-title">12. Transferência Internacional</h2>
				<p class="text-surface-700 dark:text-surface-300">
					Alguns dados podem ser transferidos para servidores fora do Brasil em razão dos provedores de infraestrutura utilizados (ex:
					Supabase, Cloudflare, Upstash Redis), sempre observando os requisitos legais aplicáveis e adotando medidas de segurança adequadas
					conforme a LGPD.
				</p>
			</section>

			<!-- Section 13 -->
			<section class="mb-10">
				<h2 class="section-title">13. Alterações na Política</h2>
				<p class="text-surface-700 dark:text-surface-300">
					Esta política pode ser atualizada periodicamente. A versão mais recente estará sempre disponível no dashboard. Alterações
					significativas serão comunicadas através dos canais de mensagens vinculados à sua conta.
				</p>
			</section>

			<!-- Section 14 -->
			<section class="mb-10">
				<h2 class="section-title">14. Contato</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados:
				</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li><strong>E-mail:</strong> jose@pinheirodev.com.br</li>
					<li><strong>Encarregado de Proteção de Dados (DPO):</strong> Equipe Nexo AI</li>
					<li><strong>Prazo de resposta:</strong> até 15 (quinze) dias úteis</li>
				</ul>
			</section>

			<!-- Section 15 -->
			<section class="mb-10">
				<h2 class="section-title">15. Foro</h2>
				<p class="text-surface-700 dark:text-surface-300">
					Fica eleito o foro da comarca do domicílio do usuário, no Brasil, como competente para dirimir quaisquer controvérsias decorrentes
					desta Política de Privacidade, nos termos do Código de Defesa do Consumidor.
				</p>
			</section>

			<!-- Footer -->
			<div class="border-t border-surface-200 dark:border-surface-800 pt-8 mt-8">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-surface-500 dark:text-surface-400">
					<div>
						<p class="font-semibold text-surface-700 dark:text-surface-300">Controlador dos Dados:</p>
						<p>Nexo AI</p>
					</div>
					<div class="flex items-center gap-4">
						<NuxtLink to="/terms-of-use" class="hover:text-primary-600 transition-colors">Termos de Uso</NuxtLink>
						<span>·</span>
						<NuxtLink to="/" class="hover:text-primary-600 transition-colors">Dashboard</NuxtLink>
					</div>
				</div>
				<p class="mt-4 text-xs text-surface-400 dark:text-surface-500">
					© {{ new Date().getFullYear() }} Nexo AI. Todos os direitos reservados.
				</p>
			</div>
		</main>
	</div>
</template>

<style scoped>
.section-title {
	@apply text-xl font-bold text-surface-900 dark:text-white mb-4 pb-2 border-b border-surface-200 dark:border-surface-800;
}

.subsection-title {
	@apply text-base font-semibold text-surface-800 dark:text-surface-200 mb-3;
}

.prose-section p {
	@apply leading-relaxed;
}
</style>
