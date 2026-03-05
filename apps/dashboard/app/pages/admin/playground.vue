<template>
	<div class="p-6 space-y-6 max-w-5xl">
		<!-- Header -->
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3"><span class="text-3xl">🧪</span> Playground</h1>
			<p class="mt-1 text-gray-500 dark:text-gray-400">Testes de infra — endpoints, embeddings, conectividade. Só visível para admins.</p>
		</div>

		<!-- CASL guard (extra segurança no template) -->
		<template v-if="!can('manage', 'AdminPanel')">
			<UAlert
				color="red"
				variant="soft"
				icon="i-heroicons-lock-closed"
				title="Acesso negado"
				description="Você não tem permissão para acessar esta página."
			/>
		</template>

		<template v-else>
			<!-- Config Info -->
			<UCard>
				<template #header>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 text-blue-500" />
							<h2 class="font-semibold text-lg">Configuração Atual</h2>
						</div>
						<UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" :loading="loadingConfig" @click="loadConfig">
							Recarregar
						</UButton>
					</div>
				</template>

				<div v-if="loadingConfig" class="flex justify-center py-4">
					<UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-gray-400" />
				</div>

				<div v-else-if="config" class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
					<div class="space-y-0.5">
						<p class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Modelo</p>
						<p class="font-mono font-semibold">{{ config.model }}</p>
					</div>
					<div class="space-y-0.5">
						<p class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Account ID</p>
						<p class="font-mono">{{ config.accountId ?? '—' }}</p>
					</div>
					<div class="space-y-0.5">
						<p class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Gateway ID</p>
						<p class="font-mono">{{ config.gatewayId ?? '—' }}</p>
					</div>
					<div class="space-y-0.5">
						<p class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Timeout</p>
						<p class="font-mono">{{ config.timeoutMs }}ms</p>
					</div>
					<div class="space-y-0.5">
						<p class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Max Retries</p>
						<p class="font-mono">{{ config.maxRetries }}</p>
					</div>
					<div class="space-y-0.5 col-span-full">
						<p class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Gateway URL</p>
						<p class="font-mono text-xs break-all text-blue-600 dark:text-blue-400">{{ config.gatewayUrl ?? '—' }}</p>
					</div>
				</div>

				<div v-else class="text-gray-400 text-sm">Falha ao carregar configuração.</div>
			</UCard>

			<!-- Embedding Test -->
			<UCard>
				<template #header>
					<div class="flex items-center gap-2">
						<UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-purple-500" />
						<h2 class="font-semibold text-lg">Geração de Embedding</h2>
					</div>
				</template>

				<div class="space-y-4">
					<UFormGroup label="Texto para gerar embedding" help="Mínimo 1 caractere. Textos > 2000 chars serão truncados.">
						<UTextarea v-model="embeddingText" placeholder="Ex: Inception é um filme de ficção científica de 2010..." :rows="4" resize />
					</UFormGroup>

					<div class="flex items-center gap-3">
						<UButton
							color="purple"
							:loading="loadingEmbedding"
							:disabled="!embeddingText.trim()"
							icon="i-heroicons-bolt"
							@click="testEmbedding"
						>
							Gerar Embedding
						</UButton>
						<span v-if="embeddingText" class="text-xs text-gray-400"> {{ embeddingText.length }} chars </span>
					</div>

					<!-- Resultado -->
					<div v-if="embeddingResult" class="space-y-3">
						<UAlert
							:color="embeddingResult.success ? 'green' : 'red'"
							:variant="embeddingResult.success ? 'soft' : 'soft'"
							:icon="embeddingResult.success ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
							:title="embeddingResult.success ? '✅ Embedding gerado com sucesso' : '❌ Falha ao gerar embedding'"
						/>

						<!-- Métricas de sucesso -->
						<div v-if="embeddingResult.success && embeddingResult.data" class="grid grid-cols-2 md:grid-cols-4 gap-3">
							<UCard class="text-center">
								<p class="text-2xl font-bold text-purple-600">{{ embeddingResult.data.dimensions }}</p>
								<p class="text-xs text-gray-500 mt-0.5">Dimensões</p>
							</UCard>
							<UCard class="text-center">
								<p class="text-2xl font-bold text-blue-600">{{ embeddingResult.data.elapsedMs }}ms</p>
								<p class="text-xs text-gray-500 mt-0.5">Tempo</p>
							</UCard>
							<UCard class="text-center">
								<p class="text-2xl font-bold text-cyan-600">{{ embeddingResult.data.magnitude }}</p>
								<p class="text-xs text-gray-500 mt-0.5">Magnitude</p>
							</UCard>
							<UCard class="text-center">
								<p class="text-2xl font-bold" :class="embeddingResult.data.isZeroVector ? 'text-red-500' : 'text-green-600'">
									{{ embeddingResult.data.isZeroVector ? '⚠️ ZERO' : '✅ OK' }}
								</p>
								<p class="text-xs text-gray-500 mt-0.5">Vetor</p>
							</UCard>
						</div>

						<!-- Vector sample -->
						<div v-if="embeddingResult.success && embeddingResult.data" class="space-y-2">
							<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amostra do Vetor</p>
							<div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs overflow-x-auto">
								<span class="text-gray-400">primeiros 5: </span>
								<span class="text-green-600 dark:text-green-400">
									[{{ embeddingResult.data.sample.first5.map((v: number) => v.toFixed(6)).join(', ') }}]
								</span>
								<br />
								<span class="text-gray-400">últimos 5: &nbsp; </span>
								<span class="text-blue-600 dark:text-blue-400">
									[{{ embeddingResult.data.sample.last5.map((v: number) => v.toFixed(6)).join(', ') }}]
								</span>
							</div>
						</div>

						<!-- Erro -->
						<div v-if="!embeddingResult.success" class="space-y-2">
							<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalhes do Erro</p>
							<div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 font-mono text-xs text-red-700 dark:text-red-300 space-y-1">
								<div v-if="embeddingResult.error"><span class="text-gray-500">mensagem: </span>{{ embeddingResult.error }}</div>
								<div v-if="embeddingResult.status != null">
									<span class="text-gray-500">HTTP status: </span>
									<span :class="embeddingResult.status >= 500 ? 'font-bold' : ''">{{ embeddingResult.status }}</span>
								</div>
								<div v-if="embeddingResult.code"><span class="text-gray-500">código: </span>{{ embeddingResult.code }}</div>
								<div v-if="embeddingResult.elapsedMs != null">
									<span class="text-gray-500">tempo até erro: </span>{{ embeddingResult.elapsedMs }}ms
								</div>
							</div>
						</div>
					</div>
				</div>
			</UCard>

			<!-- Connectivity Check -->
			<UCard>
				<template #header>
					<div class="flex items-center gap-2">
						<UIcon name="i-heroicons-signal" class="w-5 h-5 text-orange-500" />
						<h2 class="font-semibold text-lg">Diagnóstico de Conectividade</h2>
					</div>
				</template>

				<div class="space-y-4">
					<p class="text-sm text-gray-500">
						Testa a conexão direta com a Cloudflare AI Gateway e a Workers AI API. Útil para diagnosticar erros 502.
					</p>

					<UButton color="orange" variant="soft" :loading="loadingConnectivity" icon="i-heroicons-wifi" @click="checkConnectivity">
						Verificar Conectividade
					</UButton>

					<div v-if="connectivityResult" class="space-y-3">
						<div
							v-for="check in connectivityResult.checks"
							:key="check.target"
							class="flex items-start gap-3 p-4 rounded-lg border"
							:class="
								check.ok
									? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
									: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
							"
						>
							<div class="mt-0.5 shrink-0">
								<UIcon
									:name="check.ok ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
									class="w-5 h-5"
									:class="check.ok ? 'text-green-500' : 'text-red-500'"
								/>
							</div>
							<div class="flex-1 min-w-0 space-y-1">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-semibold text-sm">{{ check.target }}</span>
									<UBadge :color="check.ok ? 'green' : 'red'" variant="subtle" size="xs">
										{{ check.ok ? 'OK' : 'FALHOU' }}
									</UBadge>
									<UBadge v-if="check.status" color="gray" variant="outline" size="xs"> HTTP {{ check.status }} </UBadge>
									<span class="text-xs text-gray-400">{{ check.elapsedMs }}ms</span>
								</div>
								<p class="text-xs font-mono text-gray-500 break-all">{{ check.url }}</p>
								<p v-if="check.error" class="text-xs text-red-600 dark:text-red-400 font-mono">
									{{ check.error }}
								</p>
							</div>
						</div>
					</div>
				</div>
			</UCard>
		</template>
	</div>
</template>

<script setup lang="ts">
import { useAbility } from '@casl/vue';
import { onMounted, ref } from 'vue';

definePageMeta({
	middleware: ['auth', 'role'],
	layout: 'default',
});

const { can } = useAbility();
const { apiUrl } = useRuntimeConfig().public;

// ─── Config ─────────────────────────────────────────────────────────────────
const loadingConfig = ref(false);
const config = ref<{
	model: string;
	accountId: string | null;
	gatewayId: string | null;
	timeoutMs: number;
	maxRetries: number;
	gatewayUrl: string | null;
} | null>(null);

async function loadConfig() {
	loadingConfig.value = true;
	try {
		const res = await $fetch<{ success: boolean; data: typeof config.value }>(`${apiUrl}/admin/playground/config`, {
			credentials: 'include',
		});
		if (res.success) config.value = res.data;
	} catch {
		config.value = null;
	} finally {
		loadingConfig.value = false;
	}
}

// ─── Embedding ──────────────────────────────────────────────────────────────
const loadingEmbedding = ref(false);
const embeddingText = ref('');
const embeddingResult = ref<{
	success: boolean;
	data?: {
		dimensions: number;
		magnitude: number;
		isZeroVector: boolean;
		elapsedMs: number;
		sample: { first5: number[]; last5: number[] };
	};
	error?: string;
	status?: number | null;
	code?: string | null;
	elapsedMs?: number;
} | null>(null);

async function testEmbedding() {
	if (!embeddingText.value.trim()) return;
	loadingEmbedding.value = true;
	embeddingResult.value = null;
	try {
		const res = await $fetch<typeof embeddingResult.value>(`${apiUrl}/admin/playground/embedding`, {
			method: 'POST',
			credentials: 'include',
			body: { text: embeddingText.value },
		});
		embeddingResult.value = res;
	} catch (err: any) {
		const body = err?.data ?? err?.response?._data ?? null;
		embeddingResult.value = {
			success: false,
			error: body?.error ?? err?.message ?? 'Erro desconhecido',
			status: body?.status ?? err?.statusCode ?? null,
			code: body?.code ?? null,
			elapsedMs: body?.elapsedMs ?? null,
		};
	} finally {
		loadingEmbedding.value = false;
	}
}

// ─── Connectivity ───────────────────────────────────────────────────────────
const loadingConnectivity = ref(false);
const connectivityResult = ref<{
	checks: Array<{
		target: string;
		url: string;
		ok: boolean;
		status?: number;
		elapsedMs: number;
		error?: string;
	}>;
} | null>(null);

async function checkConnectivity() {
	loadingConnectivity.value = true;
	connectivityResult.value = null;
	try {
		const res = await $fetch<{ success: boolean; data: typeof connectivityResult.value }>(`${apiUrl}/admin/playground/connectivity`, {
			method: 'POST',
			credentials: 'include',
		});
		if (res.success) connectivityResult.value = res.data;
	} catch (err: any) {
		connectivityResult.value = {
			checks: [
				{
					target: 'Erro ao consultar API',
					url: '',
					ok: false,
					elapsedMs: 0,
					error: err?.data?.error ?? err?.message ?? 'Erro desconhecido',
				},
			],
		};
	} finally {
		loadingConnectivity.value = false;
	}
}

// ─── Init ────────────────────────────────────────────────────────────────────
onMounted(loadConfig);
</script>
