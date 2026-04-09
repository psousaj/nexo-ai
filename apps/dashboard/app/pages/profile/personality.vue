<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Brain, FileText, Heart, Sparkles, User, Wrench } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { api } from '~/utils/api';

const authStore = useAuthStore();
const queryClient = useQueryClient();

// Tab state
type ProfileTab = 'personality' | 'identity' | 'instructions' | 'user' | 'memory' | 'tools';
const activeTab = ref<ProfileTab>('personality');

// Fetch current profile
const { data: profile, isLoading } = useQuery({
	queryKey: ['agent-profile', authStore.user?.id],
	queryFn: async () => {
		const response = await api.get('/api/agent/profile');
		return response.data;
	},
	enabled: computed(() => !!authStore.user?.id),
});

// Local form state
const formData = ref({
	soulContent: '',
	identityContent: '',
	agentsContent: '',
	userContent: '',
	memoryContent: '',
	toolsContent: '',
});

// Update form when profile loads
watchEffect(() => {
	if (profile.value) {
		formData.value = {
			soulContent: profile.value.soulContent || '',
			identityContent: profile.value.identityContent || '',
			agentsContent: profile.value.agentsContent || '',
			userContent: profile.value.userContent || '',
			memoryContent: profile.value.memoryContent || '',
			toolsContent: profile.value.toolsContent || '',
		};
	}
});

// Save mutation
const saveMutation = useMutation({
	mutationFn: async () => {
		return api.post('/api/agent/profile', formData.value);
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['agent-profile'] });
		// Show success message
		showSuccessNotification();
	},
});

// Reset to defaults
const resetMutation = useMutation({
	mutationFn: async () => {
		return api.post('/api/agent/profile/reset');
	},
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['agent-profile'] });
		showResetNotification();
	},
});

function showSuccessNotification() {
	// TODO: Implement notification
	console.log('Profile saved successfully');
}

function showResetNotification() {
	// TODO: Implement notification
	console.log('Profile reset to defaults');
}

const tabs: Array<{ id: ProfileTab; label: string; icon: any; description: string }> = [
	{
		id: 'personality',
		label: 'Personalidade',
		icon: Heart,
		description: 'SOUL.md - Tom de voz, vibe, estilo de comunicação',
	},
	{ id: 'identity', label: 'Identidade', icon: Sparkles, description: 'IDENTITY.md - Nome, emoji, creature' },
	{
		id: 'instructions',
		label: 'Instruções',
		icon: FileText,
		description: 'AGENTS.md - Comportamento e regras do assistente',
	},
	{ id: 'user', label: 'Perfil', icon: User, description: 'USER.md - Informações sobre você' },
	{ id: 'memory', label: 'Memória', icon: Brain, description: 'MEMORY.md - Contexto de longo prazo' },
	{ id: 'tools', label: 'Ferramentas', icon: Wrench, description: 'TOOLS.md - Documentação de ferramentas' },
];

const examples = {
	personality: [
		{
			title: 'Amigável',
			content:
				'Você é um assistente amigável e caloroso. Usa linguagem simples e emojis moderadamente. Gosta de fazer perguntas sobre o dia do usuário.',
		},
		{
			title: 'Profissional',
			content:
				'Você é um assistente profissional e direto. Foca em eficiência e clareza. Usa linguagem formal e evita redundâncias.',
		},
		{
			title: 'Gamer',
			content:
				'Você é um assistente com vibe gamer. Usa gírias de games, referências a gaming, e entusiasta. Parabéns成就 desbloqueados!',
		},
	],
	identity: [
		{ title: 'Raposa', content: 'Nome: NEXO\nEmoji: 🦊\nCreature: Raposa\nCurioso, esperto e amigável.' },
		{ title: 'Coruja', content: 'Nome: Sábio\nEmoji: 🦉\nCreature: Coruja\nSábio, observador e filosófico.' },
	],
};
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 text-primary-500 font-bold text-xs uppercase tracking-widest mb-1">
					<Sparkles class="w-3.5 h-3.5" /> Personalidade do Assistente
				</div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">
					Perfil OpenClaw
				</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">
					Customize a personalidade do seu assistente usando o padrão OpenClaw.
				</p>
			</div>
			<div class="flex items-center gap-3">
				<button
					@click="resetMutation.mutate"
					:disabled="resetMutation.isPending.value"
					class="flex items-center gap-2 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-xl font-bold text-sm hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<RotateCcw class="w-4 h-4" />
					Resetar
				</button>
				<button
					@click="saveMutation.mutate"
					:disabled="saveMutation.isPending.value"
					class="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-xl font-bold text-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/25"
				>
					<Save class="w-4 h-4" />
					{{ saveMutation.isPending.value ? 'Salvando...' : 'Salvar Alterações' }}
				</button>
			</div>
		</div>

		<div v-if="isLoading" class="animate-pulse">
			<div class="h-96 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
		</div>

		<div v-else class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Tabs Navigation -->
			<div class="lg:col-span-1 space-y-2">
				<button
					v-for="tab in tabs"
					:key="tab.id"
					@click="activeTab = tab.id"
					:class="[
						'w-full text-left p-4 rounded-xl transition-all group',
						activeTab === tab.id
							? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
							: 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700',
					]"
				>
					<div class="flex items-center gap-3 mb-1">
						<component :is="tab.icon" class="w-5 h-5" />
						<span class="font-black text-sm">{{ tab.label }}</span>
					</div>
					<p class="text-xs opacity-80 font-medium">{{ tab.description }}</p>
				</button>
			</div>

			<!-- Tab Content -->
			<div class="lg:col-span-3">
				<!-- Personality Tab (SOUL.md) -->
				<div v-if="activeTab === 'personality'" class="space-y-6">
					<div class="premium-card p-6">
						<h3 class="text-xl font-black text-surface-900 dark:text-white mb-4 flex items-center gap-2">
							<Heart class="w-5 h-5 text-primary-500" />
							Personalidade (SOUL.md)
						</h3>
						<p class="text-sm text-surface-600 dark:text-surface-400 mb-6">
							Define o tom de voz, vibe e estilo de comunicação do seu assistente.
						</p>

						<textarea
							v-model="formData.soulContent"
							rows="12"
							placeholder="Ex: Você é um assistente amigável e caloroso. Usa linguagem simples e emojis moderadamente..."
							class="w-full p-4 bg-surface-50 dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-xl focus:border-primary-500 focus:ring-0 text-surface-900 dark:text-white font-mono text-sm resize-none"
						></textarea>

						<!-- Examples -->
						<div class="mt-6">
							<p class="text-xs font-bold text-surface-400 uppercase tracking-widest mb-3">Exemplos</p>
							<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
								<button
									v-for="example in examples.personality"
									:key="example.title"
									@click="formData.soulContent = example.content"
									class="text-left p-3 bg-surface-100 dark:bg-surface-800 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
								>
									<p class="font-black text-xs text-primary-500 mb-1">{{ example.title }}</p>
									<p class="text-xs text-surface-600 dark:text-surface-400 line-clamp-2">{{ example.content }}</p>
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Identity Tab (IDENTITY.md) -->
				<div v-if="activeTab === 'identity'" class="space-y-6">
					<div class="premium-card p-6">
						<h3 class="text-xl font-black text-surface-900 dark:text-white mb-4 flex items-center gap-2">
							<Sparkles class="w-5 h-5 text-primary-500" />
							Identidade (IDENTITY.md)
						</h3>
						<p class="text-sm text-surface-600 dark:text-surface-400 mb-6">
							Nome, emoji e creature do assistente.
						</p>

						<textarea
							v-model="formData.identityContent"
							rows="8"
							placeholder="Ex: Nome: NEXO&#10;Emoji: 🦊&#10;Creature: Raposa"
							class="w-full p-4 bg-surface-50 dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-xl focus:border-primary-500 focus:ring-0 text-surface-900 dark:text-white font-mono text-sm resize-none"
						></textarea>

						<!-- Examples -->
						<div class="mt-6">
							<p class="text-xs font-bold text-surface-400 uppercase tracking-widest mb-3">Exemplos</p>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<button
									v-for="example in examples.identity"
									:key="example.title"
									@click="formData.identityContent = example.content"
									class="text-left p-3 bg-surface-100 dark:bg-surface-800 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
								>
									<p class="font-black text-xs text-primary-500 mb-1">{{ example.title }}</p>
									<p class="text-xs text-surface-600 dark:text-surface-400 whitespace-pre-line">{{ example.content }}</p>
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Instructions Tab (AGENTS.md) -->
				<div v-if="activeTab === 'instructions'" class="space-y-6">
					<div class="premium-card p-6">
						<h3 class="text-xl font-black text-surface-900 dark:text-white mb-4 flex items-center gap-2">
							<FileText class="w-5 h-5 text-primary-500" />
							Instruções (AGENTS.md)
						</h3>
						<p class="text-sm text-surface-600 dark:text-surface-400 mb-6">
							Regras de comportamento e instruções específicas do assistente.
						</p>

						<textarea
							v-model="formData.agentsContent"
							rows="12"
							placeholder="Ex: - Sempre confirme antes de salvar itens&#10;- Use emojis moderadamente&#10;- Pergunte se o usuário quer mais informações"
							class="w-full p-4 bg-surface-50 dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-xl focus:border-primary-500 focus:ring-0 text-surface-900 dark:text-white font-mono text-sm resize-none"
						></textarea>
					</div>
				</div>

				<!-- User Profile Tab (USER.md) -->
				<div v-if="activeTab === 'user'" class="space-y-6">
					<div class="premium-card p-6">
						<h3 class="text-xl font-black text-surface-900 dark:text-white mb-4 flex items-center gap-2">
							<User class="w-5 h-5 text-primary-500" />
							Perfil do Usuário (USER.md)
						</h3>
						<p class="text-sm text-surface-600 dark:text-surface-400 mb-6">
							Informações sobre você que o assistente deve conhecer (usado apenas em DMs).
						</p>

						<textarea
							v-model="formData.userContent"
							rows="10"
							placeholder="Ex: Nome: João&#10;Interesses: Ficção científica, tecnologia, culinária&#10;Prefere: Respostas concisas"
							class="w-full p-4 bg-surface-50 dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-xl focus:border-primary-500 focus:ring-0 text-surface-900 dark:text-white font-mono text-sm resize-none"
						></textarea>

						<div class="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
							<p class="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
								<span class="font-bold">⚠️ Privacidade:</span> Este conteúdo é usado apenas em conversas diretas (DMs), nunca em grupos.
							</p>
						</div>
					</div>
				</div>

				<!-- Memory Tab (MEMORY.md) -->
				<div v-if="activeTab === 'memory'" class="space-y-6">
					<div class="premium-card p-6">
						<h3 class="text-xl font-black text-surface-900 dark:text-white mb-4 flex items-center gap-2">
							<Brain class="w-5 h-5 text-primary-500" />
							Memória de Longo Prazo (MEMORY.md)
						</h3>
						<p class="text-sm text-surface-600 dark:text-surface-400 mb-6">
							Contexto persistente sobre o usuário e preferências (usado apenas na sessão main).
						</p>

						<textarea
							v-model="formData.memoryContent"
							rows="10"
							placeholder="Ex: João adora filmes de ficção científica&#10;Prefere respostas curtas e diretas&#10;Gosta de receber recomendações de novos filmes"
							class="w-full p-4 bg-surface-50 dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-xl focus:border-primary-500 focus:ring-0 text-surface-900 dark:text-white font-mono text-sm resize-none"
						></textarea>

						<div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
							<p class="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
								<span class="font-bold">ℹ️ Sessão Main:</span> Este conteúdo é injetado apenas na sessão principal, não em sessões secundárias.
							</p>
						</div>
					</div>
				</div>

				<!-- Tools Tab (TOOLS.md) -->
				<div v-if="activeTab === 'tools'" class="space-y-6">
					<div class="premium-card p-6">
						<h3 class="text-xl font-black text-surface-900 dark:text-white mb-4 flex items-center gap-2">
							<Wrench class="w-5 h-5 text-primary-500" />
							Documentação de Ferramentas (TOOLS.md)
						</h3>
						<p class="text-sm text-surface-600 dark:text-surface-400 mb-6">
							Documentação das ferramentas disponíveis para o assistente.
						</p>

						<textarea
							v-model="formData.toolsContent"
							rows="10"
							placeholder="Ex: - save_movie: Salva filme na lista do usuário&#10;- search_items: Busca itens salvos&#10;- get_tmdb_info: Busca informações no TMDB"
							class="w-full p-4 bg-surface-50 dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-xl focus:border-primary-500 focus:ring-0 text-surface-900 dark:text-white font-mono text-sm resize-none"
						></textarea>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
