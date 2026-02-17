<script setup lang="ts">
import { BrainCircuit, Clapperboard, Link2, StickyNote } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';

const _isMenuOpen = ref(false);
const usersCount = ref(0);

// Animação do contador
onMounted(() => {
	const target = 1534;
	const duration = 2000;
	const increment = target / (duration / 16);

	let current = 0;
	const timer = setInterval(() => {
		current += increment;
		if (current >= target) {
			clearInterval(timer);
			current = target;
		}
		usersCount.value = Math.floor(current);
	}, 16);
});

const _features = [
	{
		icon: Clapperboard,
		title: 'Filmes e Séries',
		description: 'Envie o nome e receba info completa do TMDB, notas e onde assistir.',
	},
	{
		icon: Link2,
		title: 'Links Inteligentes',
		description: 'Guarde links de artigos e vídeos. O Nexo lê o conteúdo e categoriza pra você.',
	},
	{
		icon: StickyNote,
		title: 'Notas Rápidas',
		description: 'Transforme áudios e textos em tarefas e lembretes organizados.',
	},
	{
		icon: BrainCircuit,
		title: 'Busca Semântica',
		description: "Encontre aquele filme que 'tem um cara numa ilha' sem lembrar o nome.",
	},
];

const _testimonials = [
	{
		name: 'Ana Silva',
		role: 'Designer',
		text: 'Finalmente parei de perder recomendações de filmes nas conversas de WhatsApp. O Nexo salva tudo!',
		image: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
	},
	{
		name: 'Lucas Costa',
		role: 'Dev',
		text: 'A integração com Telegram é insana. Mando links o dia todo e depois acho tudo fácil no dashboard.',
		image: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
	},
	{
		name: 'Beatriz M.',
		role: 'Estudante',
		text: 'Uso pra salvar referências de estudo. Melhora muito minha organização sem ter que sair do chat.',
		image: 'https://i.pravatar.cc/150?u=a04258114e29026302d',
	},
];
</script>

<template>
	<div class="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-primary-200 selection:text-primary-900">
		<!-- Navbar -->
		<nav class="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex justify-between items-center h-16">
					<div class="flex items-center gap-2">
						<div class="bg-primary-600 p-1.5 rounded-lg">
							<Bot class="w-6 h-6 text-white" />
						</div>
						<span class="font-bold text-xl tracking-tight">Nexo AI</span>
					</div>

					<div class="hidden md:flex items-center space-x-8">
						<a href="#features" class="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">Funcionalidades</a>
						<a href="#how-it-works" class="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">Como Funciona</a>
						<button
							class="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40"
						>
							Acessar Dashboard
						</button>
					</div>

					<!-- Mobile menu button -->
					<div class="md:hidden">
						<button @click="isMenuOpen = !isMenuOpen" class="text-slate-600">
							<Menu v-if="!isMenuOpen" class="w-6 h-6" />
							<X v-else class="w-6 h-6" />
						</button>
					</div>
				</div>
			</div>

			<!-- Mobile Menu -->
			<div v-if="isMenuOpen" class="md:hidden bg-white border-t border-slate-100">
				<div class="px-4 pt-2 pb-6 space-y-2">
					<a href="#features" class="block py-3 text-base font-medium text-slate-600">Funcionalidades</a>
					<a href="#how-it-works" class="block py-3 text-base font-medium text-slate-600">Como Funciona</a>
					<button class="w-full mt-4 bg-primary-600 text-white px-5 py-3 rounded-xl font-medium">Acessar Dashboard</button>
				</div>
			</div>
		</nav>

		<!-- Hero Section -->
		<section class="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
			<div class="absolute inset-0 -z-10">
				<div class="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] bg-primary-200/40 rounded-full blur-3xl"></div>
				<div class="absolute bottom-0 left-0 -ml-32 -mb-32 w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-3xl"></div>
			</div>

			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
				<div
					class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-8 animate-fade-in-up"
				>
					<span class="flex h-2 w-2 relative">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
					</span>
					<span class="text-sm font-medium text-slate-600">Disponível em 3 plataformas</span>
				</div>

				<h1 class="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-[1.1]">
					Sua Segunda Memória <br />
					<span class="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Digital Inteligente</span>
				</h1>

				<p class="text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
					O assistente que organiza filmes, séries, links e notas automaticamente. Sem instalar nada novo, direto onde você já conversa.
				</p>

				<div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
					<a
						href="https://wa.me/YOUR_NUMBER"
						target="_blank"
						class="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-green-500/20 hover:scale-[1.02]"
					>
						<MessageCircle class="w-5 h-5 fill-current" />
						Usar no WhatsApp
					</a>
					<a
						href="https://t.me/YOUR_BOT"
						target="_blank"
						class="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0088cc] hover:bg-[#0077b5] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-blue-500/20 hover:scale-[1.02]"
					>
						<Send class="w-5 h-5 fill-current" />
						Usar no Telegram
					</a>
					<a
						href="#"
						class="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-indigo-500/20 hover:scale-[1.02]"
					>
						<Gamepad2 class="w-5 h-5 fill-current" />
						Usar no Discord
					</a>
				</div>

				<div class="flex items-center justify-center gap-2 text-sm text-slate-500">
					<div class="flex -space-x-2">
						<img class="w-8 h-8 rounded-full border-2 border-white" src="https://i.pravatar.cc/100?u=1" alt="" />
						<img class="w-8 h-8 rounded-full border-2 border-white" src="https://i.pravatar.cc/100?u=2" alt="" />
						<img class="w-8 h-8 rounded-full border-2 border-white" src="https://i.pravatar.cc/100?u=3" alt="" />
					</div>
					<p>
						Mais de <span class="font-bold text-slate-800">{{ usersCount }}</span> usuários organizados
					</p>
				</div>
			</div>
		</section>

		<!-- Features Grid -->
		<section id="features" class="py-24 bg-white">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="text-center max-w-3xl mx-auto mb-20">
					<h2 class="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Tudo organizado, sem esforço</h2>
					<p class="text-lg text-slate-600">
						Você envia mensagens como sempre fez. A IA entende, enriquece e organiza tudo em uma biblioteca visual linda.
					</p>
				</div>

				<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
					<div
						v-for="(feature, index) in features"
						:key="index"
						class="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all group"
					>
						<div
							class="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-primary-600 transition-colors"
						>
							<component :is="feature.icon" class="w-6 h-6 text-primary-600 group-hover:text-white transition-colors" />
						</div>
						<h3 class="text-xl font-bold text-slate-900 mb-3">{{ feature.title }}</h3>
						<p class="text-slate-600 leading-relaxed">{{ feature.description }}</p>
					</div>
				</div>
			</div>
		</section>

		<!-- How it Works -->
		<section id="how-it-works" class="py-24 bg-slate-900 text-white relative overflow-hidden">
			<!-- Background Patterns -->
			<div class="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px]"></div>

			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
				<div class="grid lg:grid-cols-2 gap-16 items-center">
					<div>
						<h2 class="text-3xl md:text-4xl font-bold mb-6">Tão simples quanto mandar um "Oi"</h2>
						<div class="space-y-8">
							<div class="flex gap-6">
								<div
									class="flex-shrink-0 w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20 text-primary-400 font-bold text-xl"
								>
									1
								</div>
								<div>
									<h3 class="text-xl font-bold mb-2">Envie uma mensagem</h3>
									<p class="text-slate-400">"Clube da Luta", "Lembrar de comprar leite", ou um link do YouTube.</p>
								</div>
							</div>
							<div class="flex gap-6">
								<div
									class="flex-shrink-0 w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20 text-primary-400 font-bold text-xl"
								>
									2
								</div>
								<div>
									<h3 class="text-xl font-bold mb-2">IA Entende e Enriquece</h3>
									<p class="text-slate-400">Identificamos o que é, buscamos capas, notas do IMDB e categorizamos.</p>
								</div>
							</div>
							<div class="flex gap-6">
								<div
									class="flex-shrink-0 w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20 text-primary-400 font-bold text-xl"
								>
									3
								</div>
								<div>
									<h3 class="text-xl font-bold mb-2">Acesse de qualquer lugar</h3>
									<p class="text-slate-400">Sua biblioteca fica disponível no chat e em nosso dashboard web.</p>
								</div>
							</div>
						</div>
					</div>

					<div
						class="bg-slate-800 rounded-2xl p-4 shadow-2xl border border-slate-700 max-w-md mx-auto transform rotate-1 hover:rotate-0 transition-transform duration-500"
					>
						<!-- Mockup de Chat -->
						<div class="space-y-4">
							<div class="flex justify-end">
								<div class="bg-primary-600 text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[80%]">
									Me indica onde assistir O Poderoso Chefão?
								</div>
							</div>
							<div class="flex justify-start">
								<div class="bg-slate-700 text-slate-100 px-4 py-3 rounded-2xl rounded-tl-none max-w-[90%] shadow-lg">
									<p class="font-bold mb-2">🎬 O Poderoso Chefão (1972)</p>
									<p class="text-sm text-yellow-500 mb-2">⭐⭐⭐⭐⭐ 9.2/10</p>
									<p class="text-sm mb-3">O patriarca de uma dinastia do crime organizado transfere o controle...</p>
									<div class="flex gap-2 text-xs">
										<span class="bg-slate-600 px-2 py-1 rounded">Netflix</span>
										<span class="bg-slate-600 px-2 py-1 rounded">Prime</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Social Proof -->
		<section class="py-24 bg-white">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<h2 class="text-3xl font-bold text-center mb-16 text-slate-900">Quem usa, recomenda</h2>
				<div class="grid md:grid-cols-3 gap-8">
					<div v-for="(testimonial, i) in testimonials" :key="i" class="p-8 bg-slate-50 rounded-2xl">
						<div class="flex items-center gap-4 mb-6">
							<img :src="testimonial.image" :alt="testimonial.name" class="w-12 h-12 rounded-full" />
							<div>
								<h4 class="font-bold text-slate-900">{{ testimonial.name }}</h4>
								<p class="text-sm text-primary-600">{{ testimonial.role }}</p>
							</div>
						</div>
						<p class="text-slate-600 italic">"{{ testimonial.text }}"</p>
						<div class="flex text-yellow-400 mt-4">
							<svg v-for="n in 5" :key="n" class="w-4 h-4 fill-current" viewBox="0 0 20 20">
								<path
									d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
								/>
							</svg>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Final CTA -->
		<section class="py-24 bg-primary-600 text-white text-center">
			<div class="max-w-4xl mx-auto px-4">
				<h2 class="text-4xl font-bold mb-6">Pronto para organizar sua vida digital?</h2>
				<p class="text-xl text-primary-100 mb-10">
					Junte-se a milhares de usuários que transformaram seu caos em uma biblioteca inteligente.
				</p>
				<button
					class="bg-white text-primary-600 hover:bg-slate-100 px-10 py-4 rounded-full font-bold text-lg shadow-2xl transition-all hover:scale-105"
				>
					Começar Gratuitamente
				</button>
				<p class="mt-6 text-sm text-primary-200">Sem cartão de crédito • Cancelamento a qualquer momento</p>
			</div>
		</section>

		<!-- Footer -->
		<footer class="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
			<div class="max-w-7xl mx-auto px-4 text-center">
				<div class="flex items-center justify-center gap-2 mb-8">
					<Bot class="w-6 h-6 text-primary-500" />
					<span class="text-white font-bold text-xl">Nexo AI</span>
				</div>
				<div class="flex justify-center gap-8 mb-8 text-sm">
					<a href="#" class="hover:text-white transition-colors">Termos de Uso</a>
					<a href="#" class="hover:text-white transition-colors">Privacidade</a>
					<a href="#" class="hover:text-white transition-colors">Contato</a>
				</div>
				<p class="text-sm">© 2024 Nexo AI. Todos os direitos reservados.</p>
			</div>
		</footer>
	</div>
</template>

<style>
/* CSS personalizado para animações se necessário */
@keyframes fade-in-up {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.animate-fade-in-up {
	animation: fade-in-up 0.8s ease-out forwards;
}
</style>
