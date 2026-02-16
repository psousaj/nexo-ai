<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { api } from '~/utils/api';
import { useAuthStore } from '~/stores/auth';
import { Download, Calendar, MessageCircle, Bot, Filter, Search, FileText, Clock } from 'lucide-vue-next';

definePageMeta({
	middleware: ['auth'],
});

const auth = useAuth();

// Filter state
const searchQuery = ref('');
const selectedChannel = ref<'all' | 'telegram' | 'discord' | 'whatsapp' | 'web'>('all');
const selectedPeerKind = ref<'all' | 'direct' | 'group' | 'channel'>('all');

// Fetch sessions
const { data: sessions, isLoading } = useQuery({
	queryKey: ['agent-sessions', auth.data?.user?.id],
	queryFn: async () => {
		const response = await api.get('/api/agent/sessions');
		return response.data;
	},
	enabled: computed(() => !!auth.data?.user?.id),
});

// Export session as JSONL
async function exportSessionJsonl(sessionId: string, sessionKey: string) {
	try {
		const response = await api.get(`/api/agent/sessions/${sessionId}/export`, {
			responseType: 'blob',
		});

		// Create blob and download
		const blob = new Blob([response.data], { type: 'application/x-jsonlines' });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `session-${sessionKey.replace(/:/g, '-')}.jsonl`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
	} catch (error) {
		console.error('Export failed:', error);
	}
}

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
			s.peerId.toLowerCase().includes(query),
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

// Format date
function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleString('pt-BR');
}

// Format session key parts
function parseSessionKey(key: string): { channel?: string; peerKind?: string; peerId?: string } {
	try {
		const parts = key.split(':');
		if (parts.length >= 4) {
			return {
				channel: parts[2],
				peerKind: parts[parts.length - 2],
				peerId: parts[parts.length - 1],
			};
		}
	} catch (error) {
		console.error('Failed to parse session key:', error);
	}
	return {};
}

// Get channel icon
function getChannelIcon(channel: string) {
	switch (channel) {
		case 'telegram': return '📱';
		case 'discord': return '💬';
		case 'whatsapp': return '💚';
		case 'web': return '🌐';
		default: return '❓';
	}
}

// Get peer kind badge style
function getPeerKindBadgeStyle(kind: string): string {
	switch (kind) {
		case 'direct':
			return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
		case 'group':
			return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
		case 'channel':
			return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
		default:
			return 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400';
	}
}
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 text-primary-500 font-bold text-xs uppercase tracking-widest mb-1">
					<Calendar class="w-3.5 h-3.5" /> Histórico de Sessões
				</div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">
					Sessões OpenClaw
				</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">
					Visualize e exporte o histórico de sessões do seu assistente em formato JSONL.
				</p>
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

		<!-- Loading state -->
		<div v-if="isLoading" class="animate-pulse">
			<div class="h-64 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
		</div>

		<!-- Sessions list -->
		<div v-else class="space-y-4">
			<div v-if="filteredSessions.length === 0" class="text-center py-12">
				<FileText class="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
				<p class="text-surface-500 dark:text-surface-400 font-medium">Nenhuma sessão encontrada</p>
			</div>

			<div
				v-for="session in filteredSessions"
				:key="session.id"
				class="premium-card p-6 hover:scale-[1.01] transition-all"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 space-y-4">
						<!-- Session Key -->
						<div class="flex items-center gap-3">
							<span class="text-2xl">{{ getChannelIcon(session.channel) }}</span>
							<div>
								<code class="text-sm font-mono text-surface-900 dark:text-white">{{ session.sessionKey }}</code>
							</div>
							<span
								v-if="session.peerKind"
								:class="['px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider', getPeerKindBadgeStyle(session.peerKind)]"
							>
								{{ session.peerKind }}
							</span>
						</div>

						<!-- Metadata -->
						<div class="flex flex-wrap items-center gap-6 text-xs text-surface-600 dark:text-surface-400">
							<div class="flex items-center gap-2">
								<Clock class="w-3.5 h-3.5" />
								<span>Criada: {{ formatDate(session.createdAt) }}</span>
							</div>
							<div v-if="session.lastActivityAt !== session.createdAt" class="flex items-center gap-2">
								<MessageCircle class="w-3.5 h-3.5" />
								<span>Última: {{ formatDate(session.lastActivityAt) }}</span>
							</div>
							<div v-if="session.model" class="flex items-center gap-2">
								<Bot class="w-3.5 h-3.5" />
								<span>{{ session.model }}</span>
							</div>
							<div v-if="session.thinkingLevel" class="flex items-center gap-2">
								<Brain class="w-3.5 h-3.5" />
								<span>{{ session.thinkingLevel }}</span>
							</div>
						</div>
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2">
						<button
							@click="exportSessionJsonl(session.id, session.sessionKey)"
							class="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg font-bold text-xs hover:bg-primary-600 transition-colors"
						>
							<Download class="w-3.5 h-3.5" />
							Export JSONL
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Info Box -->
		<div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
			<p class="text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
				<span class="font-bold">ℹ️ Formato JSONL:</span>
				<span>O JSONL (JSON Lines) é um formato onde cada linha é um objeto JSON válido, ideal para processamento de logs e streaming de dados.</span>
			</p>
		</div>
	</div>
</template>
