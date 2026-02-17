<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useDashboard } from '~/composables/useDashboard';

definePageMeta({
	middleware: ['role'],
});

const dashboard = useDashboard();

const { data: conversations, isLoading } = useQuery({
	queryKey: ['admin-conversations'],
	queryFn: () => dashboard.getConversations(),
});
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-widest mb-1">
					<EyeOff class="w-3.5 h-3.5" /> Monitoramento Anônimo
				</div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">Conversas Recentes</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">Analise a interação da IA sem comprometer a privacidade dos usuários.</p>
			</div>
		</div>

		<div v-if="isLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
			<div v-for="i in 4" :key="i" class="h-64 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
		</div>

		<div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div
				v-for="conv in conversations"
				:key="conv.id"
				class="premium-card group hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden"
			>
				<div
					:class="[
						'absolute inset-y-0 left-0 w-1.5',
						conv.sentiment === 'positive' ? 'bg-emerald-500' : conv.sentiment === 'negative' ? 'bg-rose-500' : 'bg-surface-300',
					]"
				></div>

				<div class="flex items-start justify-between mb-6">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400">
							<User v-if="conv.platform === 'WhatsApp'" class="w-6 h-6" />
							<MessageSquare v-else class="w-6 h-6" />
						</div>
						<div>
							<div class="flex items-center gap-2">
								<span class="font-black text-surface-900 dark:text-white">{{ conv.userHash }}</span>
								<span class="px-2 py-0.5 bg-surface-100 dark:bg-surface-800 rounded-md text-[10px] font-bold text-surface-500">{{
									conv.platform
								}}</span>
							</div>
							<p class="text-xs text-surface-500 font-medium flex items-center gap-1 mt-0.5">
								<Clock class="w-3 h-3" /> {{ conv.lastInteraction }} • {{ conv.messageCount }} mensagens
							</p>
						</div>
					</div>

					<div
						:class="[
							'p-2 rounded-xl',
							conv.sentiment === 'positive'
								? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
								: conv.sentiment === 'negative'
									? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
									: 'bg-surface-100 text-surface-400',
						]"
					>
						<ThumbsUp v-if="conv.sentiment === 'positive'" class="w-5 h-5" />
						<ThumbsDown v-else-if="conv.sentiment === 'negative'" class="w-5 h-5" />
						<MessageCircle v-else class="w-5 h-5" />
					</div>
				</div>

				<div class="space-y-3">
					<p class="text-[10px] font-black text-surface-400 uppercase tracking-widest">Destaques da Interação</p>
					<div class="space-y-2">
						<div
							v-for="(highlight, i) in conv.highlights || []"
							:key="i"
							class="flex items-center gap-3 p-3 bg-surface-50/50 dark:bg-surface-900/50 rounded-xl border border-surface-100 dark:border-surface-800 group-hover:bg-white dark:group-hover:bg-surface-800 transition-colors"
						>
							<div class="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
							<span class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ highlight }}</span>
						</div>
					</div>
				</div>

				<div class="mt-6 flex items-center justify-between pt-4 border-t border-surface-100 dark:border-surface-800">
					<span class="text-xs font-bold text-surface-400 uppercase">Duração: {{ conv.duration }}</span>
					<button class="flex items-center gap-2 text-primary-600 font-bold text-sm group/btn">
						Inspecionar Fluxo <ChevronRight class="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
					</button>
				</div>
			</div>
		</div>
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
</style>
