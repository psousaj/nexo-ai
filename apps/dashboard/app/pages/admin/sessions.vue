<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { api } from '~/utils/api';
import { Key, Search, Filter, Activity, Users, MessageSquare, Eye, ExternalLink } from 'lucide-vue-next';

definePageMeta({
	middleware: ['role'], // Admin only
});

// Filter state
const searchQuery = ref('');
const selectedChannel = ref<'all' | 'telegram' | 'discord' | 'whatsapp' | 'web'>('all');
const selectedPeerKind = ref<'all' | 'direct' | 'group' | 'channel'>('all');

// Fetch all sessions (admin view)
const { data: sessions, isLoading, refetch } = useQuery({
	queryKey: ['admin-sessions'],
	queryFn: async () => {
		const response = await api.get('/api/admin/sessions');
		return response.data;
	},
});

// Session details modal
const selectedSession = ref<any>(null);

// Filter sessions
const filteredSessions = computed(() => {
	if (!sessions.value) return [];

	let filtered = sessions.value;

	// Search filter
	if (searchQuery.value) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter((s: any) =>
			s.sessionKey.toLowerCase().includes(query) ||
			s.channel.toLowerCase().includes(query) ||
			s.peerId.toLowerCase().includes(query) ||
			(s.userId && s.userId.toLowerCase().includes(query)),
		);
	}

	// Channel filter
	if (selectedChannel.value !== 'all') {
		filtered = filtered.filter((s: any) => s.channel === selectedChannel.value);
	}

	// Peer kind filter
	if (selectedPeerKind.value !== 'all') {
		filtered = filtered.filter((s: any) => s.peerKind === selectedPeerKind.value);
	}

	return filtered;
});

// Statistics
const stats = computed(() => {
	if (!sessions.value) return { total: 0, channels: {}, peerKinds: {}, activeLast24h: 0 };

	const total = sessions.value.length;
	const channels: Record<string, number> = {};
	const peerKinds: Record<string, number> = {};

	// Count by channel
	sessions.value.forEach((s: any) => {
		channels[s.channel] = (channels[s.channel] || 0) + 1;
		peerKinds[s.peerKind] = (peerKinds[s.peerKind] || 0) + 1;
	});

	// Active in last 24h
	const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const activeLast24h = sessions.value.filter((s: any) => new Date(s.lastActivityAt) > last24h).length;

	return { total, channels, peerKinds, activeLast24h };
});

// Format date
function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 60) return `${diffMins}min atrás`;
	if (diffHours < 24) return `${diffHours}h atrás`;
	if (diffDays < 7) return `${diffDays}d atrás`;
	return date.toLocaleDateString('pt-BR');
}

// Get channel badge
function getChannelBadge(channel: string): { icon: string; color: string } {
	switch (channel) {
		case 'telegram':
			return { icon: '📱', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' };
		case 'discord':
			return { icon: '💬', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' };
		case 'whatsapp':
			return { icon: '💚', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' };
		case 'web':
			return { icon: '🌐', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' };
		default:
			return { icon: '❓', color: 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400' };
	}
}

// Parse session key
function parseSessionKey(key: string) {
	const parts = key.split(':');
	return {
		agentId: parts[1] || 'unknown',
		channel: parts[2] || 'unknown',
		peerKind: parts[parts.length - 2] || 'unknown',
		peerId: parts[parts.length - 1] || 'unknown',
	};
}
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-widest mb-1">
					<Key class="w-3.5 h-3.5" /> Admin - Sessões
				</div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">
					Session Keys OpenClaw
				</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">
					Visualize e monitore todas as sessões ativas no sistema.
				</p>
			</div>
		</div>

		<!-- Statistics -->
		<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
			<div class="premium-card p-4">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
						<Activity class="w-5 h-5" />
					</div>
					<div>
						<p class="text-2xl font-black text-surface-900 dark:text-white">{{ stats.total }}</p>
						<p class="text-xs text-surface-500 font-medium">Total</p>
					</div>
				</div>
			</div>

			<div class="premium-card p-4">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
						<MessageSquare class="w-5 h-5" />
					</div>
					<div>
						<p class="text-2xl font-black text-surface-900 dark:text-white">{{ stats.activeLast24h }}</p>
						<p class="text-xs text-surface-500 font-medium">24h</p>
					</div>
				</div>
			</div>

			<div class="col-span-2 premium-card p-4">
				<p class="text-xs text-surface-500 font-medium mb-2">Por Canal</p>
				<div class="flex flex-wrap gap-2">
					<span
						v-for="(count, channel) in stats.channels"
						:key="channel"
						class="px-2 py-1 rounded-md text-xs font-bold"
						:class="getChannelBadge(channel).color"
					>
						{{ getChannelBadge(channel).icon }} {{ channel }}: {{ count }}
					</span>
				</div>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-4 p-4 bg-surface-50 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
			<div class="relative flex-1 min-w-[200px]">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Buscar sessões..."
					class="w-full pl-10 pr-4 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:border-primary-500 focus:ring-0 text-sm"
				/>
			</div>

			<select
				v-model="selectedChannel"
				class="px-4 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:border-primary-500 focus:ring-0 text-sm"
			>
				<option value="all">Todos os Canais</option>
				<option value="telegram">Telegram</option>
				<option value="discord">Discord</option>
				<option value="whatsapp">WhatsApp</option>
				<option value="web">Web</option>
			</select>

			<select
				v-model="selectedPeerKind"
				class="px-4 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:border-primary-500 focus:ring-0 text-sm"
			>
				<option value="all">Todos os Tipos</option>
				<option value="direct">Direto</option>
				<option value="group">Grupo</option>
				<option value="channel">Canal</option>
			</select>
		</div>

		<!-- Sessions List -->
		<div v-if="isLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<div v-for="i in 6" :key="i" class="h-48 bg-surface-100 dark:bg-surface-800 rounded-2xl animate-pulse"></div>
		</div>

		<div v-else class="space-y-4">
			<div v-if="filteredSessions.length === 0" class="text-center py-12">
				<Key class="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
				<p class="text-surface-500 dark:text-surface-400 font-medium">Nenhuma sessão encontrada</p>
			</div>

			<div
				v-for="session in filteredSessions"
				:key="session.id"
				class="premium-card p-5 hover:scale-[1.01] transition-all cursor-pointer"
				@click="selectedSession = session"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 space-y-3">
						<!-- Session Key -->
						<div class="flex items-center gap-3">
							<span class="text-2xl">{{ getChannelBadge(session.channel).icon }}</span>
							<div>
								<code class="text-sm font-mono text-surface-900 dark:text-white">{{ session.sessionKey }}</code>
							</div>
						</div>

						<!-- Details -->
						<div class="flex flex-wrap items-center gap-4 text-xs text-surface-600 dark:text-surface-400">
							<div class="flex items-center gap-1.5">
								<Users class="w-3.5 h-3.5" />
								<span v-if="session.userId">{{ session.userId.substring(0, 8) }}...</span>
								<span v-else class="text-amber-600">Sem usuário</span>
							</div>
							<div class="flex items-center gap-1.5">
								<Eye class="w-3.5 h-3.5" />
								<span>{{ session.peerKind }}</span>
							</div>
							<div class="flex items-center gap-1.5">
								<Activity class="w-3.5 h-3.5" />
								<span>{{ formatDate(session.lastActivityAt) }}</span>
							</div>
							<div v-if="session.dmScope" class="px-2 py-0.5 bg-surface-100 dark:bg-surface-800 rounded font-mono text-[10px]">
								{{ session.dmScope }}
							</div>
						</div>

						<!-- Model & Thinking -->
						<div v-if="session.model || session.thinkingLevel" class="flex items-center gap-2">
							<span v-if="session.model" class="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-bold">
								{{ session.model }}
							</span>
							<span v-if="session.thinkingLevel" class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold">
								{{ session.thinkingLevel }}
							</span>
						</div>
					</div>

					<!-- Link to Conversation -->
					<div v-if="session.conversationId" class="flex items-center gap-2">
						<a
							:href="`/admin/conversations`"
							class="p-2 bg-surface-100 dark:bg-surface-800 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
							title="Ver conversa"
						>
							<ExternalLink class="w-4 h-4" />
						</a>
					</div>
				</div>
			</div>
		</div>

		<!-- Session Details Modal -->
		<div v-if="selectedSession" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" @click.self="selectedSession = null">
			<div class="bg-white dark:bg-surface-900 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-xl font-black text-surface-900 dark:text-white">Detalhes da Sessão</h3>
					<button @click="selectedSession = null" class="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg">
						✕
					</button>
				</div>

				<div class="space-y-4">
					<div>
						<p class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Session Key</p>
						<code class="block p-3 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm font-mono break-all">
							{{ selectedSession.sessionKey }}
						</code>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<p class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">ID</p>
							<p class="text-sm font-mono text-surface-700 dark:text-surface-300">{{ selectedSession.id }}</p>
						</div>
						<div>
							<p class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">User ID</p>
							<p class="text-sm font-mono text-surface-700 dark:text-surface-300">
								{{ selectedSession.userId || 'Não vinculado' }}
							</p>
						</div>
						<div>
							<p class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Conversation ID</p>
							<p class="text-sm font-mono text-surface-700 dark:text-surface-300">
								{{ selectedSession.conversationId || 'Não vinculado' }}
							</p>
						</div>
						<div>
							<p class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">DM Scope</p>
							<p class="text-sm text-surface-700 dark:text-surface-300">{{ selectedSession.dmScope }}</p>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<p class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Criada</p>
							<p class="text-sm text-surface-700 dark:text-surface-300">{{ new Date(selectedSession.createdAt).toLocaleString('pt-BR') }}</p>
						</div>
						<div>
							<p class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Última Atividade</p>
							<p class="text-sm text-surface-700 dark:text-surface-300">{{ new Date(selectedSession.lastActivityAt).toLocaleString('pt-BR') }}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
