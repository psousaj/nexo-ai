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
				<h1 class="text-4xl font-black text-surface-900 dark:text-white mb-3">Termos de Uso</h1>
				<p class="text-surface-500 dark:text-surface-400 text-lg">Leia atentamente os termos e condições antes de usar nossa plataforma.</p>
				<div
					class="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-surface-100 dark:bg-surface-800 rounded-full text-sm text-surface-600 dark:text-surface-400"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
					<strong>Última atualização:</strong>&nbsp;{{ lastUpdate }}
				</div>
			</div>

			<!-- Divider -->
			<div class="border-t border-surface-200 dark:border-surface-800 mb-10" />

			<!-- Section 1 -->
			<section class="mb-10">
				<h2 class="section-title">1. Aceitação dos Termos</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					Ao acessar ou utilizar o assistente de mensagens <strong>Nexo AI</strong> (doravante, "Plataforma") — seja via Telegram, WhatsApp,
					Discord ou pelo dashboard web —, você declara que leu, entendeu e concorda com estes Termos de Uso e com nossa
					<NuxtLink to="/privacy-policy" class="text-primary-600 hover:underline">Política de Privacidade</NuxtLink>. Caso não concorde com
					algum dos termos, não utilize a Plataforma.
				</p>
			</section>

			<!-- Section 2 -->
			<section class="mb-10">
				<h2 class="section-title">2. Descrição da Plataforma</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					O <strong>Nexo AI</strong> é um assistente de inteligência artificial para mensagens que permite ao usuário salvar, organizar e
					buscar conteúdos pessoais — incluindo filmes, séries, vídeos, links e anotações — diretamente via conversas no Telegram, WhatsApp
					e Discord. O acesso também é disponibilizado por meio de um dashboard web para gerenciamento dos conteúdos salvos.
				</p>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed mt-3">
					A Plataforma utiliza processamento de linguagem natural e inteligência artificial para interpretar as mensagens do usuário,
					classificar intenções e executar ações de forma determinística e segura.
				</p>
			</section>

			<!-- Section 3 -->
			<section class="mb-10">
				<h2 class="section-title">3. Propriedade Intelectual</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					Todos os direitos de propriedade intelectual relacionados à Plataforma, incluindo código-fonte, marcas, logotipos, design e
					funcionalidades, pertencem ao <strong>Nexo AI</strong> ou a seus licenciadores. Nenhum direito ou licença é concedido ao usuário
					além dos expressamente previstos nestes Termos de Uso.
				</p>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed mt-3">
					Os conteúdos salvos pelo usuário (filmes, links, anotações etc.) permanecem de propriedade do próprio usuário. O Nexo AI não
					reivindica qualquer direito sobre o conteúdo pessoal armazenado.
				</p>
			</section>

			<!-- Section 4 -->
			<section class="mb-10">
				<h2 class="section-title">4. Regras de Uso</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">O usuário compromete-se a:</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>Utilizar a Plataforma de maneira ética e em conformidade com as leis aplicáveis</li>
					<li>Não realizar atividades fraudulentas, ilícitas ou prejudiciais</li>
					<li>Não tentar contornar os sistemas de autenticação ou controle de acesso</li>
					<li>Não enviar conteúdo ofensivo, discriminatório, ilegal ou que viole direitos de terceiros</li>
					<li>Não utilizar a Plataforma para fins de spam, automação abusiva ou sobrecarga do sistema</li>
					<li>Manter suas credenciais de acesso em sigilo e não compartilhá-las com terceiros</li>
					<li>Notificar imediatamente o suporte em caso de uso não autorizado da sua conta</li>
				</ul>
			</section>

			<!-- Section 5 -->
			<section class="mb-10">
				<h2 class="section-title">5. Uso de Inteligência Artificial</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					A Plataforma utiliza modelos de inteligência artificial para interpretar suas mensagens e executar ações. Ao utilizar o Nexo AI,
					você compreende e concorda que:
				</p>

				<div class="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 mb-5">
					<p class="font-bold text-surface-900 dark:text-white mb-3">Princípio de Controle Determinístico</p>
					<p class="text-surface-700 dark:text-surface-300 text-sm leading-relaxed">
						O Nexo AI adota uma arquitetura onde a IA analisa e planeja, mas <strong>o código controla toda a execução e o fluxo</strong>.
						Nenhuma ação é executada de forma autônoma pela IA sem passar por validação determinística do sistema. Isso garante
						previsibilidade, segurança e rastreabilidade de todas as operações.
					</p>
				</div>

				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>
						<strong>Classificação de Intenções:</strong> Suas mensagens são analisadas por classificadores de linguagem natural para
						identificar a ação desejada (salvar, buscar, deletar conteúdo etc.)
					</li>
					<li>
						<strong>Vetores de Embeddings:</strong> Os conteúdos que você salva são convertidos em vetores numéricos (embeddings de 384
						dimensões) armazenados associados à sua conta para permitir busca semântica
					</li>
					<li>
						<strong>Planejamento de Ações:</strong> Para comandos complexos, um modelo de linguagem (LLM — Google Gemini ou Cloudflare
						Workers AI como fallback) é utilizado para planejar a ação adequada dentro de um esquema estritamente validado
					</li>
					<li>
						<strong>Limitações da IA:</strong> As respostas da IA podem ocasionalmente conter imprecisões. O usuário é responsável por
						verificar a precisão dos conteúdos salvos
					</li>
				</ul>

				<div class="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl">
					<p class="text-sm text-blue-800 dark:text-blue-300">
						<strong>Nota sobre privacidade da IA:</strong> As mensagens processadas pelo LLM são enviadas ao provedor de IA para geração de
						resposta. Não armazenamos históricos de processamento nos servidores dos provedores de IA — apenas o resultado final da ação é
						persistido em nosso banco de dados.
					</p>
				</div>
			</section>

			<!-- Section 6 -->
			<section class="mb-10">
				<h2 class="section-title">6. Integração com Plataformas de Mensagens</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-6">
					O Nexo AI opera como bot nas plataformas de mensagens abaixo. Ao vincular sua conta, você concede as permissões necessárias para
					que o assistente possa receber e responder às suas mensagens.
				</p>

				<!-- Telegram -->
				<div class="mb-6">
					<h3 class="subsection-title flex items-center gap-2">
						<span class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-black">T</span>
						6.1 Telegram
					</h3>
					<div class="space-y-3 text-surface-700 dark:text-surface-300">
						<p>
							Ao adicionar o bot do Nexo AI no Telegram e iniciar uma conversa, você autoriza o recebimento e processamento das mensagens
							enviadas ao bot.
						</p>
						<p>
							<strong>O que fazemos:</strong> Recebemos suas mensagens, classificamos a intenção e executamos a ação solicitada (salvar,
							buscar, listar ou deletar conteúdos). Respondemos no próprio chat do Telegram.
						</p>
						<p>
							<strong>O que não fazemos:</strong> Não lemos mensagens de outros chats ou grupos não autorizados. Não acessamos sua lista de
							contatos, fotos ou arquivos além dos explicitamente compartilhados no chat com o bot.
						</p>
						<p>Você pode desvincular o Telegram a qualquer momento via <strong>Perfil → Contas conectadas</strong> no dashboard.</p>
					</div>
				</div>

				<!-- WhatsApp -->
				<div class="mb-6">
					<h3 class="subsection-title flex items-center gap-2">
						<span class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-black">W</span>
						6.2 WhatsApp
					</h3>
					<div class="space-y-3 text-surface-700 dark:text-surface-300">
						<p>
							Ao interagir com o número do Nexo AI no WhatsApp, você autoriza o processamento das mensagens enviadas. A integração pode
							operar via WhatsApp Business API (Meta) ou via conexão direta.
						</p>
						<p>
							<strong>O que fazemos:</strong> Recebemos suas mensagens pelo número oficial do assistente, processamos a intenção e
							respondemos com a confirmação da ação executada.
						</p>
						<p>
							<strong>O que não fazemos:</strong> Não acessamos seu histórico de conversas com outros contatos, sua agenda ou outros dados
							do WhatsApp além das mensagens trocadas com o bot.
						</p>
						<p>Você pode desvincular o WhatsApp a qualquer momento via <strong>Perfil → Contas conectadas</strong> no dashboard.</p>
					</div>
				</div>

				<!-- Discord -->
				<div class="mb-6">
					<h3 class="subsection-title flex items-center gap-2">
						<span class="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-black">D</span>
						6.3 Discord
					</h3>
					<div class="space-y-3 text-surface-700 dark:text-surface-300">
						<p>
							Ao adicionar o bot do Nexo AI a um servidor Discord ou iniciar uma DM, você autoriza o processamento das mensagens enviadas ao
							bot. O Discord também pode ser utilizado como provedor de autenticação OAuth no dashboard web.
						</p>
						<p>
							<strong>O que fazemos:</strong> Recebemos mensagens enviadas diretamente ao bot ou em canais onde ele foi invocado
							explicitamente, processamos a intenção e respondemos na mesma conversa.
						</p>
						<p>
							<strong>O que não fazemos:</strong> O bot não lê mensagens de canais em que não foi invocado e não acessa dados do servidor
							além das mensagens dirigidas ao bot.
						</p>
						<p>Você pode desvincular o Discord a qualquer momento via <strong>Perfil → Contas conectadas</strong> no dashboard.</p>
					</div>
				</div>
			</section>

			<!-- Section 7 -->
			<section class="mb-10">
				<h2 class="section-title">7. Conteúdo Salvo pelo Usuário</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					O Nexo AI permite salvar os seguintes tipos de conteúdo:
					<strong>filmes, séries/programas de TV, vídeos (YouTube), links e anotações pessoais</strong>. Ao salvar conteúdos, você concorda
					que:
				</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>Você é o único responsável pelos conteúdos que escolhe salvar</li>
					<li>Não salvará conteúdos que violem direitos autorais, privacidade de terceiros ou legislação aplicável</li>
					<li>Os conteúdos são armazenados em banco de dados seguro e acessíveis apenas por você</li>
					<li>
						Metadados de enriquecimento (pôsteres, sinopses, avaliações) são obtidos de APIs externas (TMDB, YouTube) mediante os
						respectivos termos de serviço desses provedores
					</li>
					<li>Você pode solicitar a exclusão de qualquer conteúdo salvo via comando ao assistente ou pelo dashboard</li>
				</ul>
			</section>

			<!-- Section 8 -->
			<section class="mb-10">
				<h2 class="section-title">8. Limitação de Responsabilidade</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4">
					A Plataforma é fornecida "como está", sem qualquer garantia expressa ou implícita. O Nexo AI não será responsável por:
				</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>Danos diretos, indiretos ou consequenciais decorrentes do uso ou da impossibilidade de uso da Plataforma</li>
					<li>Perda de dados em caso de falha técnica, desde que adotadas as medidas de backup razoáveis</li>
					<li>Imprecisões nos metadados obtidos via APIs externas (TMDB, YouTube, OpenGraph)</li>
					<li>Interrupções temporárias do serviço decorrentes de manutenção ou problemas nas plataformas de mensagens terceiras</li>
					<li>Uso indevido da conta por terceiros em decorrência de negligência do próprio usuário na guarda de credenciais</li>
				</ul>
			</section>

			<!-- Section 9 -->
			<section class="mb-10">
				<h2 class="section-title">9. Disponibilidade do Serviço</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					O Nexo AI busca manter alta disponibilidade do serviço, mas não garante operação ininterrupta. Manutenções programadas,
					atualizações de sistema e eventuais falhas de infraestrutura podem causar indisponibilidades temporárias. O sistema utiliza filas
					de processamento (Bull + Redis) para garantir que mensagens recebidas durante picos de carga sejam processadas com retentativas
					automáticas.
				</p>
			</section>

			<!-- Section 10 -->
			<section class="mb-10">
				<h2 class="section-title">10. Política de Privacidade</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					O uso de dados pessoais pela Plataforma é regulado pela nossa
					<NuxtLink to="/privacy-policy" class="text-primary-600 hover:underline font-semibold">Política de Privacidade</NuxtLink>, que deve
					ser lida em conjunto com estes Termos de Uso. Em caso de conflito entre os dois documentos, prevalece o que for mais favorável ao
					usuário titular dos dados.
				</p>
			</section>

			<!-- Section 11 -->
			<section class="mb-10">
				<h2 class="section-title">11. Alterações nos Termos</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					O Nexo AI pode modificar estes Termos de Uso a qualquer momento, notificando os usuários via mensagem nos canais vinculados ou por
					e-mail. O uso contínuo da Plataforma após tais modificações implica a aceitação dos novos termos. Recomendamos revisar
					periodicamente esta página.
				</p>
			</section>

			<!-- Section 12 -->
			<section class="mb-10">
				<h2 class="section-title">12. Rescisão e Exclusão de Conta</h2>
				<p class="text-surface-700 dark:text-surface-300 mb-4 leading-relaxed">
					Você pode encerrar o uso da Plataforma e solicitar a exclusão da sua conta a qualquer momento pelo dashboard. O Nexo AI pode
					suspender ou encerrar o acesso do usuário à Plataforma, sem aviso prévio, em caso de:
				</p>
				<ul class="list-disc list-outside ml-5 space-y-2 text-surface-700 dark:text-surface-300">
					<li>Violação destes Termos de Uso</li>
					<li>Uso inadequado ou abusivo da Plataforma</li>
					<li>Atividades que prejudiquem a infraestrutura ou outros usuários</li>
					<li>Determinação judicial ou regulatória</li>
				</ul>
			</section>

			<!-- Section 13 -->
			<section class="mb-10">
				<h2 class="section-title">13. Bloqueio de Usuários</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					O Nexo AI reserva-se o direito de bloquear, temporária ou permanentemente, usuários que descumprirem estes Termos ou cujas ações
					sejam consideradas abusivas, prejudiciais à Plataforma ou à sua comunidade. Em casos de bloqueio por tempo determinado, o usuário
					será notificado quando possível.
				</p>
			</section>

			<!-- Section 14 -->
			<section class="mb-10">
				<h2 class="section-title">14. Legislação e Foro</h2>
				<p class="text-surface-700 dark:text-surface-300 leading-relaxed">
					Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial pelo Código de Defesa do Consumidor (Lei nº
					8.078/1990), Marco Civil da Internet (Lei nº 12.965/2014) e LGPD (Lei nº 13.709/2018). Qualquer disputa será resolvida
					preferencialmente de forma amigável; caso não seja possível, fica eleito o foro do domicílio do usuário no Brasil.
				</p>
			</section>

			<!-- Footer -->
			<div class="border-t border-surface-200 dark:border-surface-800 pt-8 mt-8">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-surface-500 dark:text-surface-400">
					<div>
						<p class="font-semibold text-surface-700 dark:text-surface-300">Nexo AI</p>
						<p>Assistente de mensagens inteligente</p>
					</div>
					<div class="flex items-center gap-4">
						<NuxtLink to="/privacy-policy" class="hover:text-primary-600 transition-colors">Política de Privacidade</NuxtLink>
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
</style>
