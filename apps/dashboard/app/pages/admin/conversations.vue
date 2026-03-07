<script setup lang="ts">
import { useAbility } from '@casl/vue';
import { useQuery } from '@tanstack/vue-query';
import { ChevronRight, Clock, EyeOff, Loader2, MessageCircle, MessageSquare, X } from 'lucide-vue-next';
import { useDashboard } from '~/composables/useDashboard';
import { useAuthStore } from '~/stores/auth';
import type { ConversationAudit, ConversationSummary } from '~/types/dashboard';

definePageMeta({
	middleware: ['role'],
});

const { can } = useAbility();
const canAudit = computed(() => can('read', 'ConversationAudit'));

const authStore = useAuthStore();
const dashboard = useDashboard();

const { data: conversations, isLoading } = useQuery({
	queryKey: ['admin-conversations'],
	queryFn: () => dashboard.getConversations(),
});

// Audit panel state
const selectedConv = ref<ConversationSummary | null>(null);
const auditData = ref<ConversationAudit | null>(null);
const isLoadingAudit = ref(false);
const auditError = ref<string | null>(null);

async function openAudit(conv: ConversationSummary) {
	if (!canAudit.value) return;
	selectedConv.value = conv;
	auditData.value = null;
	auditError.value = null;
	isLoadingAudit.value = true;
	try {
		auditData.value = await dashboard.getConversationMessages(conv.id);
	} catch {
		auditError.value = 'Falha ao carregar mensagens da conversa.';
	} finally {
		isLoadingAudit.value = false;
	}
}

function closeAudit() {
	selectedConv.value = null;
	auditData.value = null;
	auditError.value = null;
}

function isOwn(conv: ConversationSummary) {
	return conv.userId === authStore.user?.id;
}

function formatTime(dateStr: string) {
	return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Provider visual config
const providerConfig = {
	telegram: {
		label: 'Telegram',
		accent: 'from-sky-400 to-blue-600',
		border: 'border-sky-200 dark:border-sky-800',
		bg: 'bg-sky-50 dark:bg-sky-950/40',
		badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
		bar: 'bg-sky-500',
		icon: '✈️',
	},
	whatsapp: {
		label: 'WhatsApp',
		accent: 'from-emerald-400 to-green-600',
		border: 'border-emerald-200 dark:border-emerald-800',
		bg: 'bg-emerald-50 dark:bg-emerald-950/40',
		badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
		bar: 'bg-emerald-500',
		icon: '💬',
	},
	discord: {
		label: 'Discord',
		accent: 'from-indigo-400 to-violet-600',
		border: 'border-indigo-200 dark:border-indigo-800',
		bg: 'bg-indigo-50 dark:bg-indigo-950/40',
		badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
		bar: 'bg-indigo-500',
		icon: '🎮',
	},
	unknown: {
		label: 'Desconhecido',
		accent: 'from-surface-400 to-surface-600',
		border: 'border-surface-200 dark:border-surface-700',
		bg: 'bg-surface-50 dark:bg-surface-850',
		badge: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
		bar: 'bg-surface-400',
		icon: '🔲',
	},
} as const;

function providerCfg(provider: string) {
	return providerConfig[provider as keyof typeof providerConfig] ?? providerConfig.unknown;
}

// Audit panel: display identifier — nome próprio se for o próprio usuário, senão hash
function displayIdentifier(conv: ConversationSummary) {
	if (isOwn(conv)) return authStore.user?.name ?? conv.userHash;
	return conv.userHash;
}
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<div>
			<div class="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-widest mb-1">
				<EyeOff class="w-3.5 h-3.5" /> Auditoria — LGPD Compliant
			</div>
			<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">Conversas Recentes</h2>
			<p class="text-surface-500 dark:text-surface-400 mt-1">
				Identidades anonimizadas por padrão. Seu próprio nome é exibido quando a conversa é sua.
			</p>
		</div>

		<!-- CASL guard -->
		<UAlert
			v-if="!canAudit"
			color="error"
			variant="soft"
			icon="i-heroicons-lock-closed"
			title="Acesso Restrito"
			description="Você não tem permissão para auditar conversas."
		/>

		<template v-else>
			<div v-if="isLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
				<div v-for="i in 4" :key="i" class="h-48 bg-surface-100 dark:bg-surface-800 rounded-2xl" />
			</div>

			<div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-5">
				<div
					v-for="conv in conversations"
					:key="conv.id"
					:class="[
						'relative overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg',
						providerCfg(conv.provider).border,
						providerCfg(conv.provider).bg,
					]"
					@click="openAudit(conv)"
				>
					<!-- Accent bar top -->
					<div :class="['h-1 w-full bg-gradient-to-r', providerCfg(conv.provider).accent]" />

					<div class="p-5">
						<!-- Header row -->
						<div class="flex items-start justify-between gap-3 mb-4">
							<div class="flex items-center gap-3">
								<!-- Provider icon circle -->
								<div
									:class="[
										'w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 bg-gradient-to-br shadow-sm',
										providerCfg(conv.provider).accent,
									]"
								>
									{{ providerCfg(conv.provider).icon }}
								</div>

								<div>
									<div class="flex items-center gap-2 flex-wrap">
										<!-- Identifier: nome se for o próprio, hash se for outro (LGPD) -->
										<span
											:class="[
												'font-black text-sm',
												isOwn(conv)
													? 'text-primary-600 dark:text-primary-400'
													: 'text-surface-700 dark:text-surface-300 font-mono',
											]"
										>
											{{ displayIdentifier(conv) }}
										</span>

										<span v-if="isOwn(conv)" class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 uppercase">
											você
										</span>

										<!-- Provider badge -->
										<span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', providerCfg(conv.provider).badge]">
											{{ providerCfg(conv.provider).label }}
										</span>
									</div>

									<p class="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1 mt-0.5">
										<Clock class="w-3 h-3" />
										{{ formatTime(conv.lastInteraction) }} · {{ conv.messageCount }} msg
									</p>
								</div>
							</div>

							<!-- Message count badge -->
							<div class="shrink-0 flex items-center gap-1 text-surface-400">
								<MessageSquare class="w-4 h-4" />
								<span class="text-sm font-bold">{{ conv.messageCount }}</span>
							</div>
						</div>

						<!-- Footer row -->
						<div class="flex items-center justify-between pt-3 border-t border-surface-200/60 dark:border-surface-700/60">
							<code class="text-[10px] text-surface-400">{{ conv.id.slice(0, 8) }}…</code>
							<span class="flex items-center gap-1 text-xs font-bold text-surface-500 dark:text-surface-400 group-hover:text-primary-600 transition-colors">
								Inspecionar <ChevronRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
							</span>
						</div>
					</div>
				</div>
			</div>
		</template>

		<!-- Audit slide-over -->
		<Teleport to="body">
			<Transition name="slide">
				<div v-if="selectedConv" class="fixed inset-0 z-50 flex justify-end">
					<div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeAudit" />

					<div class="relative w-full max-w-2xl bg-white dark:bg-surface-900 shadow-2xl flex flex-col h-full overflow-hidden">
						<!-- Header -->
						<div
							:class="[
								'flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700',
								providerCfg(selectedConv.provider).bg,
							]"
						>
							<div>
								<div class="flex items-center gap-2 mb-0.5">
									<span class="text-xs font-bold uppercase tracking-widest text-rose-500">Auditoria</span>
									<span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', providerCfg(selectedConv.provider).badge]">
										{{ providerCfg(selectedConv.provider).label }}
									</span>
								</div>
								<h3 class="text-base font-black text-surface-900 dark:text-white font-mono">
									{{ displayIdentifier(selectedConv) }}
								</h3>
								<p class="text-[10px] text-surface-500 font-mono">ID: {{ selectedConv.id }}</p>
							</div>
							<button class="p-2 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-surface-500" @click="closeAudit">
								<X class="w-5 h-5" />
							</button>
						</div>

						<!-- Conversation meta -->
						<div v-if="auditData" class="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex flex-wrap gap-4 text-xs">
							<span><strong>Estado:</strong> <code class="px-1.5 py-0.5 bg-white dark:bg-surface-800 rounded">{{ auditData.conversation.state }}</code></span>
							<span><strong>Ativo:</strong> {{ auditData.conversation.isActive ? '✅' : '❌' }}</span>
							<span><strong>Criado:</strong> {{ formatTime(auditData.conversation.createdAt) }}</span>
							<span><strong>Atualizado:</strong> {{ formatTime(auditData.conversation.updatedAt) }}</span>
							<span><strong>Msgs:</strong> {{ auditData.messages.length }}</span>
						</div>

						<!-- Loading -->
						<div v-if="isLoadingAudit" class="flex-1 flex items-center justify-center gap-3 text-surface-400">
							<Loader2 class="w-6 h-6 animate-spin" />
							<span class="font-medium">Carregando mensagens…</span>
						</div>

						<!-- Error -->
						<div v-else-if="auditError" class="flex-1 flex items-center justify-center p-8">
							<UAlert color="error" variant="soft" icon="i-heroicons-exclamation-circle" :description="auditError" />
						</div>

						<!-- Messages -->
						<div v-else-if="auditData" class="flex-1 overflow-y-auto px-6 py-4 space-y-3">
							<div v-if="auditData.messages.length === 0" class="text-center text-surface-400 py-12">
								Nenhuma mensagem registrada.
							</div>

							<div
								v-for="msg in auditData.messages"
								:key="msg.id"
								:class="['flex gap-3', msg.role === 'user' ? 'justify-start' : 'justify-end']"
							>
								<div v-if="msg.role === 'user'" class="max-w-[80%]">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-[10px] font-bold text-surface-400 uppercase">Usuário</span>
										<span class="text-[10px] text-surface-400">{{ formatTime(msg.createdAt) }}</span>
									</div>
									<div class="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-surface-800 dark:text-surface-200">
										{{ msg.content }}
									</div>
								</div>

								<div v-else class="max-w-[80%]">
									<div class="flex items-center gap-2 justify-end mb-1">
										<span class="text-[10px] text-surface-400">{{ formatTime(msg.createdAt) }}</span>
										<span class="text-[10px] font-bold text-primary-500 uppercase">Assistente</span>
										<span v-if="msg.provider" class="text-[10px] text-surface-400 font-mono">[{{ msg.provider }}]</span>
									</div>
									<div class="bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-2xl rounded-tr-none px-4 py-3 text-sm text-surface-800 dark:text-surface-200">
										{{ msg.content }}
									</div>
								</div>
							</div>
						</div>

						<!-- Context JSONB collapsible -->
						<div v-if="auditData?.conversation.context" class="border-t border-surface-200 dark:border-surface-700">
							<details class="group">
								<summary class="px-6 py-3 text-xs font-bold text-surface-500 uppercase tracking-widest cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 flex items-center gap-2">
									<ChevronRight class="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
									Contexto JSONB
								</summary>
								<div class="px-6 pb-4">
									<pre class="text-xs bg-surface-50 dark:bg-surface-800 rounded-xl p-4 overflow-auto max-h-48 text-surface-700 dark:text-surface-300">{{ JSON.stringify(auditData.conversation.context, null, 2) }}</pre>
								</div>
							</details>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn {
	from { opacity: 0; transform: translateY(20px); }
	to   { opacity: 1; transform: translateY(0); }
}
.slide-enter-active, .slide-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(100%); }
.slide-enter-to, .slide-leave-from { opacity: 1; transform: translateX(0); }
</style>
