<script setup lang="ts">
import { useAbility } from '@casl/vue';
import { useQuery } from '@tanstack/vue-query';
import { Activity, Check, ChevronRight, Clock, Copy, EyeOff, Loader2, MessageCircle, MessageSquare, X } from 'lucide-vue-next';
import { useDashboard } from '~/composables/useDashboard';
import { useAuthStore } from '~/stores/auth';
import type { ConversationAudit, ConversationMessage, ConversationSummary, OrchestratorTrace } from '~/types/dashboard';

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
		accent: 'from-slate-400 to-slate-600',
		border: 'border-surface-200 dark:border-surface-700',
		bg: 'bg-surface-50 dark:bg-surface-800',
		badge: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400',
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

// ─── Trace helpers ───────────────────────────────────────────────────────────

type MessageCycle = {
	user: ConversationMessage;
	assistant: ConversationMessage | null;
};

const messageCycles = computed<MessageCycle[]>(() => {
	if (!auditData.value) return [];
	const msgs = auditData.value.messages;
	const cycles: MessageCycle[] = [];
	let i = 0;
	while (i < msgs.length) {
		const msg = msgs[i] as ConversationMessage | undefined;
		if (!msg) {
			i++;
			continue;
		}
		if (msg.role === 'user') {
			const next = msgs[i + 1] as ConversationMessage | undefined;
			const assistant: ConversationMessage | null = next && next.role === 'assistant' ? next : null;
			cycles.push({ user: msg, assistant });
			i += assistant ? 2 : 1;
		} else {
			// orphan assistant message (e.g. very first onboarding reply)
			cycles.push({ user: null as any, assistant: msg as ConversationMessage });
			i++;
		}
	}
	return cycles;
});

function llmActionBadge(action?: string) {
	switch (action) {
		case 'CALL_TOOL':
			return { label: 'CALL_TOOL', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
		case 'RESPOND':
			return { label: 'RESPOND', class: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' };
		case 'NOOP':
			return { label: 'NOOP', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
		default:
			return null;
	}
}

function confidenceColor(c: number) {
	if (c >= 0.85) return 'bg-emerald-400';
	if (c >= 0.6) return 'bg-amber-400';
	return 'bg-rose-400';
}

const selectedProviderCfg = computed(() => (selectedConv.value ? providerCfg(selectedConv.value.provider) : providerConfig.unknown));

// ─── Trace modal ─────────────────────────────────────────────────────────────
const traceModal = ref<{ cycleIdx: number; cycle: MessageCycle } | null>(null);

function openTraceModal(idx: number, cycle: MessageCycle) {
	traceModal.value = { cycleIdx: idx, cycle };
}

function closeTraceModal() {
	traceModal.value = null;
}

// ─── Copy helpers ─────────────────────────────────────────────────────────────
function getCycleTrace(cycle: MessageCycle): OrchestratorTrace | null {
	return (cycle.assistant?.metadata?._trace as OrchestratorTrace) ?? null;
}

function formatMs(ms: number | undefined | null): string {
	if (ms == null) return '';
	if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
	return `${ms}ms`;
}

function buildCycleText(idx: number, cycle: MessageCycle): string {
	const trace = getCycleTrace(cycle);
	const date = cycle.user ? formatTime(cycle.user.createdAt) : cycle.assistant ? formatTime(cycle.assistant.createdAt) : '—';
	const totalMs = trace?.durations?.total_ms;
	let text = `=== Ciclo ${idx + 1} ===\n`;
	text += `Data: ${date}\n`;
	if (totalMs != null) text += `Tempo total: ${formatMs(totalMs)}\n`;
	text += '\n';
	if (cycle.user) {
		text += `👤 Usuário:\n${cycle.user.content}\n\n`;
	}
	if (cycle.assistant) {
		text += `🤖 Assistente:\n${cycle.assistant.content || '— sem resposta (NOOP / hostil/spam)'}\n\n`;
	}
	if (trace) {
		text += '📊 Trace:\n';
		text += `  Intent: ${trace.intent ?? '—'}`;
		if (trace.confidence != null) text += ` (${(trace.confidence * 100).toFixed(0)}%)`;
		text += '\n';
		if (trace.action) text += `  Action: ${trace.action}\n`;
		if (trace.llm_action) text += `  LLM Action: ${trace.llm_action}\n`;
		if (trace.tools_used?.length) text += `  Tools: ${trace.tools_used.join(', ')}\n`;
		if (trace.durations) {
			const d = trace.durations;
			const parts: string[] = [];
			if (d.intent_ms != null) parts.push(`intent=${d.intent_ms}ms`);
			if (d.llm_ms != null) parts.push(`llm=${d.llm_ms}ms`);
			if (d.action_ms != null) parts.push(`action=${d.action_ms}ms`);
			if (d.total_ms != null) parts.push(`total=${d.total_ms}ms`);
			if (parts.length) text += `  Durations: ${parts.join(', ')}\n`;
		}
	} else {
		text += '📊 Trace: não disponível\n';
	}
	return text;
}

const copiedCycleIdx = ref<number | null>(null);
const copiedAll = ref(false);

async function copyCycle(idx: number, cycle: MessageCycle) {
	const text = buildCycleText(idx, cycle);
	await navigator.clipboard.writeText(text);
	copiedCycleIdx.value = idx;
	setTimeout(() => {
		copiedCycleIdx.value = null;
	}, 2000);
}

async function copyAllCycles() {
	if (!auditData.value || !selectedConv.value) return;
	const conv = auditData.value.conversation;
	const cfg = providerCfg(selectedConv.value.provider);
	let text = `=== CONVERSA ${selectedConv.value.id} ===\n`;
	text += `Provider: ${cfg.label}\n`;
	text += `Usuário: ${displayIdentifier(selectedConv.value)}\n`;
	text += `Estado: ${conv.state}\n`;
	text += `Ativo: ${conv.isActive ? 'Sim' : 'Não'}\n`;
	text += `Criado: ${formatTime(conv.createdAt)}\n`;
	text += `Atualizado: ${formatTime(conv.updatedAt)}\n`;
	text += `Mensagens: ${auditData.value.messages.length}\n`;
	text += '\n';
	for (let i = 0; i < messageCycles.value.length; i++) {
		text += buildCycleText(i, messageCycles.value[i]!) + '\n';
	}
	await navigator.clipboard.writeText(text);
	copiedAll.value = true;
	setTimeout(() => {
		copiedAll.value = false;
	}, 2000);
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
					<div :class="['h-1 w-full bg-linear-to-r', providerCfg(conv.provider).accent]" />

					<div class="p-5">
						<!-- Header row -->
						<div class="flex items-start justify-between gap-3 mb-4">
							<div class="flex items-center gap-3">
								<!-- Provider icon circle -->
								<div
									:class="[
										'w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 bg-linear-to-br shadow-sm',
										providerCfg(conv.provider).accent,
									]"
								>
									{{ providerCfg(conv.provider).icon }}
								</div>

								<div>
									<div class="flex items-center gap-2 flex-wrap">
										<span
											:class="[
												'font-black text-sm',
												isOwn(conv) ? 'text-primary-600 dark:text-primary-400' : 'text-surface-700 dark:text-surface-300 font-mono',
											]"
											>{{ displayIdentifier(conv) }}</span
										>
										<span
											v-if="isOwn(conv)"
											class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 uppercase"
											>você</span
										>
										<span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold', providerCfg(conv.provider).badge]">{{
											providerCfg(conv.provider).label
										}}</span>
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
							<span
								class="flex items-center gap-1 text-xs font-bold text-surface-500 dark:text-surface-400 group-hover:text-primary-600 transition-colors"
							>
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
						<div :class="['flex items-center justify-between px-6 py-4 bg-linear-to-r', providerCfg(selectedConv.provider).accent]">
							<div>
								<div class="flex items-center gap-2 mb-0.5">
									<span class="text-xs font-bold uppercase tracking-widest text-white/80">Auditoria</span>
									<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
										{{ providerCfg(selectedConv.provider).label }}
									</span>
								</div>
								<h3 class="text-base font-black text-white font-mono">
									{{ displayIdentifier(selectedConv) }}
								</h3>
								<p class="text-[10px] text-white/60 font-mono">ID: {{ selectedConv.id }}</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									v-if="auditData"
									class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-white/15 hover:bg-white/25 text-white"
									:title="copiedAll ? 'Copiado!' : 'Copiar toda a conversa para área de transferência'"
									@click="copyAllCycles"
								>
									<Check v-if="copiedAll" class="w-4 h-4 text-emerald-300" />
									<Copy v-else class="w-4 h-4" />
									{{ copiedAll ? 'Copiado!' : 'Copiar conversa' }}
								</button>
								<button class="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/80" @click="closeAudit">
									<X class="w-5 h-5" />
								</button>
							</div>
						</div>

						<!-- Conversation meta -->
						<div
							v-if="auditData"
							class="px-6 py-3 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex flex-wrap gap-4 text-xs text-surface-600 dark:text-surface-300"
						>
							<span
								><strong class="text-surface-700 dark:text-surface-200">Estado:</strong>
								<code class="ml-1 px-1.5 py-0.5 bg-white dark:bg-surface-700 rounded font-mono">{{
									auditData.conversation.state
								}}</code></span
							>
							<span
								><strong class="text-surface-700 dark:text-surface-200">Ativo:</strong>
								{{ auditData.conversation.isActive ? '✅' : '❌' }}</span
							>
							<span
								><strong class="text-surface-700 dark:text-surface-200">Criado:</strong>
								{{ formatTime(auditData.conversation.createdAt) }}</span
							>
							<span
								><strong class="text-surface-700 dark:text-surface-200">Atualizado:</strong>
								{{ formatTime(auditData.conversation.updatedAt) }}</span
							>
							<span><strong class="text-surface-700 dark:text-surface-200">Msgs:</strong> {{ auditData.messages.length }}</span>
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

						<!-- Messages as request→response cycles -->
						<div v-else-if="auditData" class="flex-1 overflow-y-auto p-4 space-y-3">
							<div v-if="messageCycles.length === 0" class="text-center text-surface-400 py-12">Nenhuma mensagem registrada.</div>

							<div
								v-for="(cycle, idx) in messageCycles"
								:key="cycle.user?.id ?? cycle.assistant?.id"
								class="rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700 shadow-sm"
							>
								<!-- Cycle label -->
								<div
									class="flex items-center justify-between px-3 py-1.5 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700"
								>
									<div class="flex items-center gap-2">
										<div :class="['w-1.5 h-1.5 rounded-full bg-linear-to-br shrink-0', selectedProviderCfg.accent]" />
										<span class="text-[10px] font-black uppercase tracking-widest text-surface-600 dark:text-surface-300"
											>Ciclo {{ idx + 1 }}</span
										>
									</div>
									<div class="flex items-center gap-2">
										<span v-if="cycle.user" class="text-[10px] text-surface-400 dark:text-surface-500">{{
											formatTime(cycle.user.createdAt)
										}}</span>
										<span
											v-if="getCycleTrace(cycle)?.durations?.total_ms != null"
											class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
										>
											{{ formatMs(getCycleTrace(cycle)?.durations?.total_ms) }}
										</span>
										<button
											@click.stop="copyCycle(idx, cycle)"
											class="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors bg-surface-200 dark:bg-surface-700 text-surface-500 hover:bg-surface-300 dark:hover:bg-surface-600"
											title="Copiar ciclo para área de transferência"
										>
											<Check v-if="copiedCycleIdx === idx" class="w-3 h-3 text-emerald-500" />
											<Copy v-else class="w-3 h-3" />
											{{ copiedCycleIdx === idx ? 'copiado' : 'copy' }}
										</button>
										<button
											@click.stop="openTraceModal(idx, cycle)"
											:class="[
												'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors',
												cycle.assistant?.metadata?._trace
													? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 hover:bg-violet-200'
													: 'bg-surface-200 dark:bg-surface-700 text-surface-400 hover:bg-surface-300',
											]"
											:title="cycle.assistant?.metadata?._trace ? 'Ver trace de orquestração' : 'Sem trace disponível'"
										>
											<Activity class="w-3 h-3" />
											trace
										</button>
									</div>
								</div>

								<!-- User message -->
								<div v-if="cycle.user" class="px-4 py-3 bg-white dark:bg-surface-900">
									<span class="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest block mb-1.5"
										>👤 Usuário</span
									>
									<p class="text-sm text-surface-800 dark:text-surface-100 whitespace-pre-wrap leading-relaxed">{{ cycle.user.content }}</p>
								</div>

								<!-- Assistant message -->
								<div
									v-if="cycle.assistant"
									class="px-4 py-3 bg-surface-50 dark:bg-surface-800/60 border-t border-surface-200 dark:border-surface-700"
								>
									<div class="flex items-center gap-2 mb-1.5">
										<span class="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest"
											>🤖 Assistente</span
										>
										<span
											v-if="cycle.assistant.provider"
											:class="['text-[10px] font-mono px-1.5 py-0.5 rounded', selectedProviderCfg.badge]"
											>{{ cycle.assistant.provider }}</span
										>
										<span class="text-[10px] text-surface-400 dark:text-surface-500 ml-auto">{{
											formatTime(cycle.assistant.createdAt)
										}}</span>
									</div>
									<p
										v-if="cycle.assistant.content"
										class="text-sm text-surface-800 dark:text-surface-100 whitespace-pre-wrap leading-relaxed"
									>
										{{ cycle.assistant.content }}
									</p>
									<p v-else class="text-[11px] text-surface-400 dark:text-surface-500 italic">— sem resposta (NOOP / hostil/spam)</p>
								</div>
							</div>
						</div>

						<!-- Context JSONB collapsible -->
						<div v-if="auditData?.conversation.context" class="border-t border-surface-200 dark:border-surface-700">
							<details class="group">
								<summary
									class="px-6 py-3 text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center gap-2"
								>
									<ChevronRight class="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
									Contexto JSONB
								</summary>
								<div class="px-6 pb-4">
									<pre
										class="text-xs bg-surface-50 dark:bg-surface-800 rounded-xl p-4 overflow-auto max-h-48 text-surface-700 dark:text-surface-300"
										>{{ JSON.stringify(auditData.conversation.context, null, 2) }}</pre
									>
								</div>
							</details>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- Trace Modal -->
		<Teleport to="body">
			<Transition name="fade">
				<div v-if="traceModal" class="fixed inset-0 z-60 flex items-center justify-center p-4">
					<div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeTraceModal" />
					<div class="relative w-full max-w-lg bg-white dark:bg-surface-900 rounded-2xl shadow-2xl overflow-hidden">
						<!-- Header -->
						<div class="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
							<div class="flex items-center gap-2">
								<Activity class="w-4 h-4 text-violet-500" />
								<span class="font-black text-sm uppercase tracking-widest">Trace — Ciclo {{ traceModal.cycleIdx + 1 }}</span>
							</div>
							<button @click="closeTraceModal" class="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
								<X class="w-4 h-4 text-surface-500" />
							</button>
						</div>

						<!-- No trace -->
						<div
							v-if="!traceModal.cycle.assistant?.metadata?._trace"
							class="p-6 text-center text-surface-400 dark:text-surface-500 text-sm italic"
						>
							Trace não disponível para este ciclo.
						</div>

						<!-- Trace content -->
						<div v-else class="p-5 space-y-4 overflow-auto max-h-[70vh]">
							<template v-if="traceModal.cycle.assistant.metadata._trace as any">
								<!-- Intent -->
								<div class="space-y-1">
									<span class="text-[10px] font-black uppercase tracking-widest text-surface-400">Intent</span>
									<div class="flex items-center gap-2">
										<code class="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-mono">
											{{ (traceModal.cycle.assistant.metadata._trace as any).intent ?? '—' }}
										</code>
										<div
											v-if="(traceModal.cycle.assistant.metadata._trace as any).confidence != null"
											class="flex items-center gap-1.5 flex-1"
										>
											<div class="flex-1 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
												<div
													:style="{ width: ((traceModal.cycle.assistant.metadata._trace as any).confidence * 100).toFixed(0) + '%' }"
													class="h-full rounded-full bg-blue-500"
												/>
											</div>
											<span class="text-[10px] text-surface-500 font-mono">
												{{ ((traceModal.cycle.assistant.metadata._trace as any).confidence * 100).toFixed(0) }}%
											</span>
										</div>
									</div>
								</div>

								<!-- Action -->
								<div class="space-y-1">
									<span class="text-[10px] font-black uppercase tracking-widest text-surface-400">Action</span>
									<div class="flex gap-2 flex-wrap">
										<code
											v-if="(traceModal.cycle.assistant.metadata._trace as any).action"
											class="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-mono"
										>
											{{ (traceModal.cycle.assistant.metadata._trace as any).action }}
										</code>
										<code
											v-if="(traceModal.cycle.assistant.metadata._trace as any).llm_action"
											class="px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-mono"
										>
											LLM: {{ (traceModal.cycle.assistant.metadata._trace as any).llm_action }}
										</code>
									</div>
								</div>

								<!-- Tools used -->
								<div v-if="(traceModal.cycle.assistant.metadata._trace as any).tools_used?.length" class="space-y-1">
									<span class="text-[10px] font-black uppercase tracking-widest text-surface-400">Tools Used</span>
									<div class="flex flex-wrap gap-1.5">
										<span
											v-for="tool in (traceModal.cycle.assistant.metadata._trace as any).tools_used"
											:key="tool"
											class="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px]"
											>{{ tool }}</span
										>
									</div>
								</div>

								<!-- Durations -->
								<div v-if="(traceModal.cycle.assistant.metadata._trace as any).durations" class="space-y-1">
									<span class="text-[10px] font-black uppercase tracking-widest text-surface-400">Durations</span>
									<div class="flex flex-wrap gap-1.5 text-[11px] text-surface-500 dark:text-surface-400">
										<span
											v-if="(traceModal.cycle.assistant.metadata._trace as any).durations.intent_ms != null"
											class="px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-700/60"
										>
											intent
											<strong class="text-surface-700 dark:text-surface-200"
												>{{ (traceModal.cycle.assistant.metadata._trace as any).durations.intent_ms }}ms</strong
											>
										</span>
										<span
											v-if="(traceModal.cycle.assistant.metadata._trace as any).durations.llm_ms != null"
											class="px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-700/60"
										>
											llm
											<strong class="text-surface-700 dark:text-surface-200"
												>{{ (traceModal.cycle.assistant.metadata._trace as any).durations.llm_ms }}ms</strong
											>
										</span>
										<span
											v-if="(traceModal.cycle.assistant.metadata._trace as any).durations.action_ms != null"
											class="px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-700/60"
										>
											action
											<strong class="text-surface-700 dark:text-surface-200"
												>{{ (traceModal.cycle.assistant.metadata._trace as any).durations.action_ms }}ms</strong
											>
										</span>
										<span
											v-if="(traceModal.cycle.assistant.metadata._trace as any).durations.total_ms != null"
											class="px-2 py-0.5 rounded font-black bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
										>
											total {{ (traceModal.cycle.assistant.metadata._trace as any).durations.total_ms }}ms
										</span>
									</div>
								</div>
							</template>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<style scoped>
.animate-fade-in {
	animation: fadeIn 0.5s ease-out;
}
@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
.slide-enter-active,
.slide-leave-active {
	transition:
		opacity 0.25s ease,
		transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
	opacity: 0;
	transform: translateX(100%);
}
.slide-enter-to,
.slide-leave-from {
	opacity: 1;
	transform: translateX(0);
}
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
