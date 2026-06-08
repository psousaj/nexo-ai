<script setup lang="ts">
definePageMeta({
  middleware: ['role'],
  layout: 'default',
});

const toast = useToast();
const searchQuery = ref('');
const showAddProviderDialog = ref(false);
const showEditProviderDialog = ref(false);
const showAddModelDialog = ref(false);
const showKeyDialog = ref(false);
const keyProviderId = ref<number | null>(null);
const keyProviderLabel = ref('');
const keyProviderType = ref('');
const editingProvider = ref<any>(null);
const testing = ref<Record<string, boolean>>({});

const selectedTab = ref(0);
const tabItems = [
  { key: 'overview', label: 'Overview', icon: 'i-heroicons-chart-pie', description: 'Monitor and quickly toggle your active AI providers.' },
  { key: 'setup', label: 'Configurations', icon: 'i-heroicons-adjustments-horizontal', description: 'Manage API keys, register providers, and bind AI models.' }
];

const newProvider = ref({
  type: 'openai' as string,
  label: '',
  priority: 0,
  config: {} as Record<string, string>,
});

const newModel = ref({
  provider: 'openai',
  modelId: '',
  displayName: '',
  contextTypes: ['chat'] as string[],
  priority: 0,
});

const {
  providersQuery,
  keysQuery,
  addProviderMutation,
  updateProviderMutation,
  deleteProviderMutation,
  addModelMutation,
  updateModelMutation,
  deleteModelMutation,
  testProviderMutation,
  setKeyMutation,
  deleteKeyMutation,
} = useAiProviders();

const { data: providersData, isLoading } = providersQuery();
const { data: keysData } = keysQuery();

const providers = computed(() => (providersData.value?.providers ?? []) as any[]);
const keys = computed(() => keysData.value ?? []);

const modelColumns = [
  { accessorKey: 'provider', header: 'Provider' },
  { accessorKey: 'modelId', header: 'Model ID' },
  { accessorKey: 'displayName', header: 'Display Name' },
  { accessorKey: 'contextTypes', header: 'Context' },
  { accessorKey: 'priority', header: 'Priority' },
  { accessorKey: 'enabled', header: 'Active' },
  { id: 'actions', header: '' },
];

const filteredModels = computed(() => {
  const models = providersData.value?.models ?? [];
  if (!searchQuery.value) return models;
  const q = searchQuery.value.toLowerCase();
  return models.filter(
    (m: any) =>
      m.modelId.toLowerCase().includes(q) ||
      (m.displayName || '').toLowerCase().includes(q),
  );
});

const providerTypes = [
  { label: 'Cloudflare AI Gateway', value: 'cloudflare' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'Custom (OpenAI-compatible)', value: 'custom' },
];

function providerTypeLabel(type: string): string {
  return providerTypes.find((p) => p.value === type)?.label ?? type;
}

function providerFingerprint(type: string, id: number): string | null {
  const entry = keys.value.find((k: any) => k.provider === String(id));
  return entry?.fingerprint ?? null;
}

function hasKey(id: number): boolean {
  return keys.value.some((k: any) => k.provider === String(id));
}

function isCloudflare(type: string): boolean {
  return type === 'cloudflare';
}

function isCustom(type: string): boolean {
  return type === 'custom';
}

function providerColor(type: string): string {
  const colors: Record<string, string> = {
    cloudflare: 'orange',
    openai: 'green',
    deepseek: 'blue',
    custom: 'purple',
  };
  return colors[type] ?? 'neutral';
}

function openKeyDialog(p: any) {
  keyProviderId.value = p.id;
  keyProviderLabel.value = p.label;
  keyProviderType.value = p.type;
  showKeyDialog.value = true;
}

async function saveKey() {
  if (!keyProviderId.value) return;
  const config: Record<string, string> = {};
  if (isCloudflare(keyProviderType.value)) {
    config.accountId = keyForm.value.accountId || '';
    config.gatewayId = keyForm.value.gatewayId || 'nexo-ai-gateway';
  }
  if (isCustom(keyProviderType.value)) {
    config.apiBase = keyForm.value.apiBase || '';
  }
  await setKeyMutation.mutateAsync({
    provider: String(keyProviderId.value),
    key: keyForm.value.apiKey,
    config,
  });
  showKeyDialog.value = false;
  toast.add({ title: 'API Key saved', description: `${keyProviderLabel.value} configured.`, color: 'success', icon: 'i-heroicons-check-circle' });
}

async function removeKey(providerId: number) {
  await deleteKeyMutation.mutateAsync(String(providerId));
  toast.add({ title: 'Key removed', description: 'API key deleted.', color: 'success', icon: 'i-heroicons-check-circle' });
}

const keyForm = ref({ apiKey: '', accountId: '', gatewayId: '', apiBase: '' });

async function testProvider(p: any) {
  if (!hasKey(p.id)) {
    toast.add({ title: 'No API key', description: 'Set an API key before testing.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' });
    return;
  }
  testing.value[p.type] = true;
  try {
    await testProviderMutation.mutateAsync({ type: p.type, providerId: p.id });
    toast.add({ title: 'Connected', description: `${p.label} is reachable.`, color: 'success', icon: 'i-heroicons-check-circle' });
  } catch {
    toast.add({ title: 'Connection failed', description: `Could not reach ${p.label}.`, color: 'error', icon: 'i-heroicons-x-circle' });
  } finally {
    testing.value[p.type] = false;
  }
}

async function addProvider() {
  if (!newProvider.value.label.trim()) {
    toast.add({ title: 'Required', description: 'Provider label is required.', color: 'error', icon: 'i-heroicons-exclamation-triangle' });
    return;
  }
  await addProviderMutation.mutateAsync(newProvider.value);
  showAddProviderDialog.value = false;
  newProvider.value = { type: 'openai', label: '', priority: 0, config: {} };
  toast.add({ title: 'Provider added', description: 'Configure an API key to enable it.', color: 'success', icon: 'i-heroicons-check-circle' });
}

function openEditProvider(p: any) {
  editingProvider.value = p;
  newProvider.value.type = p.type;
  newProvider.value.label = p.label;
  newProvider.value.priority = p.priority;
  newProvider.value.config = p.config || {};
  showEditProviderDialog.value = true;
}

async function saveEditProvider() {
  if (!editingProvider.value) return;
  await updateProviderMutation.mutateAsync({
    id: editingProvider.value.id,
    label: newProvider.value.label,
    priority: newProvider.value.priority,
    config: newProvider.value.config,
  });
  showEditProviderDialog.value = false;
  editingProvider.value = null;
  toast.add({ title: 'Provider updated', color: 'success', icon: 'i-heroicons-check-circle' });
}

async function toggleProvider(p: any) {
  await updateProviderMutation.mutateAsync({ id: p.id, enabled: !p.enabled });
}

async function deleteProvider(p: any) {
  await deleteProviderMutation.mutateAsync(p.id);
  toast.add({ title: 'Provider removed', description: `${p.label} deleted.`, color: 'success', icon: 'i-heroicons-check-circle' });
}

async function toggleModel(row: any) {
  await updateModelMutation.mutateAsync({ id: row.id, enabled: !row.enabled });
}

async function addModel() {
  await addModelMutation.mutateAsync(newModel.value);
  showAddModelDialog.value = false;
  newModel.value = { provider: 'openai', modelId: '', displayName: '', contextTypes: ['chat'], priority: 0 };
  toast.add({ title: 'Model added', color: 'success', icon: 'i-heroicons-check-circle' });
}

async function deleteModel(id: number) {
  await deleteModelMutation.mutateAsync(id);
  toast.add({ title: 'Model removed', color: 'success', icon: 'i-heroicons-check-circle' });
}
</script>

<template>
  <div class="space-y-8 max-w-7xl mx-auto pb-10">
    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-5">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">AI Providers</h2>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-base">
          Manage AI providers and configure models. Bring Your Own Key (BYOK) to enable connections.
        </p>
      </div>
    </div>

    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <USkeleton v-for="i in 3" :key="i" class="h-48 rounded-2xl" />
    </div>

    <template v-else>
      <UTabs v-model="selectedTab" :items="tabItems" class="w-full mt-6" />

      <!-- TAB: OVERVIEW -->
      <div v-if="selectedTab === 0" class="mt-6 space-y-6 transition-all duration-300 starting:opacity-0 starting:translate-y-2">
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <UCard class="ring-gray-200 dark:ring-gray-800">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg shrink-0">
                    <UIcon name="i-heroicons-cpu-chip" class="w-6 h-6 text-primary-500" />
                  </div>
                  <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Providers</p>
                    <p class="text-2xl font-bold">{{ providers.length }}</p>
                  </div>
                </div>
              </UCard>
              <UCard class="ring-gray-200 dark:ring-gray-800">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg shrink-0">
                    <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Active Providers</p>
                    <p class="text-2xl font-bold">{{ providers.filter((p: any) => p.enabled).length }}</p>
                  </div>
                </div>
              </UCard>
              <UCard class="ring-gray-200 dark:ring-gray-800">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg shrink-0">
                    <UIcon name="i-heroicons-cube" class="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Models</p>
                    <p class="text-2xl font-bold">{{ keysData?.length ? filteredModels.length : 0 }}</p>
                  </div>
                </div>
              </UCard>
            </div>

            <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
              <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-bold text-gray-900 dark:text-white leading-none">Connection Status</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Easily test connections and toggle enabled states.</p>
                </div>
              </div>
              <div class="divide-y divide-gray-100 dark:divide-gray-800">
                <div
                  v-for="p in providers"
                  :key="p.id"
                  class="flex items-center justify-between p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div class="flex items-center gap-4">
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform hover:scale-105"
                      :class="{
                        'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 ring-1 ring-orange-500/20': p.type === 'cloudflare',
                        'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-500/20': p.type === 'openai',
                        'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 ring-1 ring-blue-500/20': p.type === 'deepseek',
                        'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 ring-1 ring-purple-500/20': p.type === 'custom',
                      }"
                    >
                      <UIcon :name="p.type === 'cloudflare' ? 'i-heroicons-cloud' : p.type === 'custom' ? 'i-heroicons-wrench-screwdriver' : 'i-heroicons-cpu-chip'" class="w-5 h-5" />
                    </div>
                    <div>
                      <p class="font-bold text-gray-900 dark:text-white text-base leading-none">{{ p.label }}</p>
                      <div class="flex items-center gap-2 mt-1">
                        <UBadge :color="p.enabled ? 'success' : 'neutral'" variant="subtle" size="xs">{{ p.enabled ? 'Active' : 'Disabled' }}</UBadge>
                        <UBadge v-if="!hasKey(p.id)" color="error" variant="subtle" size="xs">Needs API Key</UBadge>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <UButton
                      size="sm"
                      color="neutral"
                      variant="outline"
                      class="active:scale-97 transition-transform px-3"
                      :loading="testing[p.type]"
                      :disabled="!p.enabled && !hasKey(p.id)"
                      @click="testProvider(p)"
                    >
                      Test Connection
                    </UButton>
                    <USwitch
                      :model-value="p.enabled"
                      size="sm"
                      @update:model-value="toggleProvider(p)"
                    />
                  </div>
                </div>

                <div v-if="providers.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
                  No providers created yet. Go to Configurations to add the first one.
                </div>
              </div>
        </div>
</div>

      <!-- TAB: CONFIGURATIONS (Providers CRUD & Models) -->
      <div v-else-if="selectedTab === 1" class="mt-6 space-y-10 transition-all duration-300 starting:opacity-0 starting:translate-y-2">
<!-- Providers Section -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-xl font-bold text-gray-900 dark:text-white leading-none">Providers</h3>
                      <UBadge size="xs" variant="soft" color="neutral" class="rounded-full px-2">{{ providers.length }}</UBadge>
                    </div>
                  </div>
                </div>
                <UButton
                  color="primary"
                  size="md"
                  icon="i-heroicons-plus"
                  class="active:scale-97 transition-transform font-medium shadow-sm hover:shadow"
                  @click="showAddProviderDialog = true"
                >
                  Add Provider
                </UButton>
              </div>

              <div v-if="providers.length === 0" class="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center flex flex-col items-center justify-center transition-opacity duration-300 ease-out starting:opacity-0 starting:scale-95">
                <div class="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 hover:scale-105">
                  <UIcon name="i-heroicons-cpu-chip" class="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <p class="text-gray-600 dark:text-gray-300 font-semibold text-lg">No providers configured</p>
                <p class="text-gray-400 dark:text-gray-500 text-sm mt-2 max-w-sm">Bring your own key (BYOK) and connect your favorite AI providers to get started.</p>
                <UButton color="primary" class="mt-6 font-medium active:scale-97 transition-transform" @click="showAddProviderDialog = true">Add First Provider</UButton>
              </div>

              <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <div
                  v-for="(p, index) in providers"
                  :key="p.id"
                  class="relative bg-white dark:bg-gray-900 border rounded-2xl p-6 transition-all duration-200 ease-out starting:opacity-0 starting:translate-y-4 hover:shadow-xl hover:border-primary-500/30 flex flex-col h-full"
                  :style="{ transitionDelay: `${index * 50}ms` }"
                  :class="[
                    p.enabled
                      ? 'border-gray-200 dark:border-gray-700'
                      : 'border-gray-100 dark:border-gray-800 opacity-60'
                  ]"
                >
          <!-- Top row: color accent + label + status + actions -->
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105"
                :class="{
                  'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 ring-1 ring-orange-500/20': p.type === 'cloudflare',
                  'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-500/20': p.type === 'openai',
                  'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 ring-1 ring-blue-500/20': p.type === 'deepseek',
                  'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 ring-1 ring-purple-500/20': p.type === 'custom',
                }"
              >
                <UIcon
                  :name="p.type === 'cloudflare' ? 'i-heroicons-cloud' : p.type === 'custom' ? 'i-heroicons-wrench-screwdriver' : 'i-heroicons-cpu-chip'"
                  class="w-6 h-6"
                />
              </div>
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-bold text-gray-900 dark:text-white text-base leading-none">{{ p.label }}</span>
                  <UTooltip :text="p.enabled ? 'Enabled' : 'Disabled'" class="ml-1">
                    <USwitch
                      :model-value="p.enabled"
                      size="sm"
                      @update:model-value="toggleProvider(p)"
                      @click.stop
                    />
                  </UTooltip>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded uppercase tracking-wider">{{ p.type }}</span>
                  <UBadge
                    v-if="p.enabled"
                    :color="hasKey(p.id) ? 'success' : 'error'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ hasKey(p.id) ? 'Configured' : 'Missing Key' }}
                  </UBadge>
                  <UBadge v-else color="neutral" variant="subtle" size="xs">Disabled</UBadge>
                </div>
              </div>
            </div>

            <UDropdown
:items="[
              [{ label: 'Edit', icon: 'i-heroicons-pencil-square', click: () => openEditProvider(p) }],
              [{ label: 'Delete', icon: 'i-heroicons-trash', color: 'error', click: () => deleteProvider(p) }],
            ]" :popper="{ placement: 'bottom-end' }"
>
              <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-ellipsis-vertical" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </UDropdown>
          </div>

          <div class="flex-1" />

          <!-- Fingerprint -->
          <div v-if="providerFingerprint(p.type, p.id)" class="mb-4">
            <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded flex items-center gap-1.5">
              <UIcon name="i-heroicons-finger-print" class="w-3.5 h-3.5" />
              fp:{{ providerFingerprint(p.type, p.id) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
            <UButton
              size="sm"
              :color="hasKey(p.id) ? 'neutral' : 'primary'"
              variant="soft"
              class="active:scale-97 transition-transform flex-1 justify-center"
              @click="openKeyDialog(p)"
            >
              <template #leading>
                <UIcon :name="hasKey(p.id) ? 'i-heroicons-key' : 'i-heroicons-plus-circle'" />
              </template>
              {{ hasKey(p.id) ? 'Update Key' : 'Add API Key' }}
            </UButton>

            <UButton
              v-if="hasKey(p.id)"
              size="sm"
              color="error"
              variant="ghost"
              class="active:scale-97 transition-transform px-2"
              @click="removeKey(p.id)"
            >
              <UIcon name="i-heroicons-trash" />
            </UButton>

            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              class="active:scale-97 transition-transform px-3"
              :loading="testing[p.type]"
              :disabled="!p.enabled && !hasKey(p.id)"
              @click="testProvider(p)"
            >
              Test
            </UButton>
          </div>
        </div>
      </div>
      </div>

      <!-- Models Section -->
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden mt-8 shadow-sm">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105 ring-1 ring-primary-500/20">
              <UIcon name="i-heroicons-cube" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white leading-none">Models</h3>
                <UBadge size="xs" variant="soft" color="neutral" class="rounded-full px-2">{{ providers.length }}</UBadge>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage AI models available for different contexts.</p>
            </div>
          </div>
          <UButton color="primary" size="sm" icon="i-heroicons-plus" class="active:scale-97 transition-transform" @click="showAddModelDialog = true">
            Add Model
          </UButton>
        </div>
        <div class="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/20 border-b border-gray-100 dark:border-gray-800">
          <UInput v-model="searchQuery" placeholder="Search models..." icon="i-heroicons-magnifying-glass" size="md" class="max-w-md">
            <template #trailing>
              <UButton
                v-show="searchQuery !== ''"
                color="neutral"
                variant="link"
                icon="i-heroicons-x-mark-20-solid"
                :padded="false"
                @click="searchQuery = ''"
              />
            </template>
          </UInput>
        </div>
        <div class="overflow-x-auto">
          <UTable :data="filteredModels" :columns="modelColumns" class="[&_th]:text-xs [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-gray-500 [&_th]:font-semibold [&_td]:align-middle">
            <template #contextTypes-cell="{ row }">
              <div class="flex gap-1.5 flex-wrap">
                <UBadge v-for="ctx in (row.original as any).contextTypes" :key="ctx" size="xs" variant="soft" color="neutral" class="uppercase text-[10px] tracking-wide">{{ ctx }}</UBadge>
              </div>
            </template>
            <template #enabled-cell="{ row }">
              <USwitch :model-value="(row.original as any).enabled" size="sm" @update:model-value="toggleModel(row.original)" />
            </template>
            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" class="active:scale-97 transition-transform" @click="deleteModel((row.original as any).id)" />
              </div>
            </template>
          </UTable>
        </div>
      </div>
    </div>
</template>

    <!-- Add Provider Dialog -->
    <UModal v-model:open="showAddProviderDialog">
      <template #content>
        <UCard class="w-full max-w-md">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-primary-600" />
              <h3 class="text-lg font-semibold">Add Provider</h3>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField label="Provider Type" required>
              <USelect v-model="newProvider.type" :items="providerTypes" value-field="value" label-field="label" />
            </UFormField>
            <UFormField label="Label" required>
              <UInput v-model="newProvider.label" placeholder="e.g. My OpenRouter" />
            </UFormField>
            <UFormField label="Priority">
              <UInput v-model.number="newProvider.priority" type="number" placeholder="0 (highest first)" />
            </UFormField>
            <template v-if="isCustom(newProvider.type)">
              <UFormField label="API Base URL" required>
                <UInput v-model="newProvider.config.apiBase" placeholder="https://api.example.com/v1" />
              </UFormField>
            </template>
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
              <UButton color="neutral" variant="outline" class="active:scale-97 transition-transform" @click="showAddProviderDialog = false">Cancel</UButton>
              <UButton color="primary" class="active:scale-97 transition-transform" @click="addProvider">Add Provider</UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Edit Provider Dialog -->
    <UModal v-model:open="showEditProviderDialog">
      <template #content>
        <UCard class="w-full max-w-md">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-pencil-square" class="w-5 h-5 text-primary-600" />
              <h3 class="text-lg font-semibold">Edit Provider</h3>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField label="Label">
              <UInput v-model="newProvider.label" placeholder="Provider label" />
            </UFormField>
            <UFormField label="Priority">
              <UInput v-model.number="newProvider.priority" type="number" placeholder="0 (highest first)" />
            </UFormField>
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
              <UButton color="neutral" variant="outline" class="active:scale-97 transition-transform" @click="showEditProviderDialog = false">Cancel</UButton>
              <UButton color="primary" class="active:scale-97 transition-transform" @click="saveEditProvider">Save</UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- API Key Dialog -->
    <UModal v-model:open="showKeyDialog">
      <template #content>
        <UCard class="w-full max-w-md">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-key" class="w-5 h-5 text-amber-500" />
              <h3 class="text-lg font-semibold">Set API Key — {{ keyProviderLabel }}</h3>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField label="API Key" required>
              <UInput v-model="keyForm.apiKey" type="password" placeholder="sk-..." />
            </UFormField>
            <template v-if="isCloudflare(keyProviderType)">
              <UFormField label="Cloudflare Account ID" required>
                <UInput v-model="keyForm.accountId" placeholder="abc123..." />
              </UFormField>
              <UFormField label="Gateway ID">
                <UInput v-model="keyForm.gatewayId" placeholder="nexo-ai-gateway" />
              </UFormField>
            </template>
            <template v-if="isCustom(keyProviderType)">
              <UFormField label="API Base URL">
                <UInput v-model="keyForm.apiBase" placeholder="https://api.example.com/v1" />
              </UFormField>
            </template>
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
              <UButton color="neutral" variant="outline" class="active:scale-97 transition-transform" @click="showKeyDialog = false">Cancel</UButton>
              <UButton color="primary" class="active:scale-97 transition-transform" @click="saveKey">Save Key</UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Add Model Dialog -->
    <UModal v-model:open="showAddModelDialog">
      <template #content>
        <UCard class="w-full max-w-md">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cube" class="w-5 h-5 text-primary-600" />
              <h3 class="text-lg font-semibold">Add Model</h3>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField label="Provider" required>
              <USelect v-model="newModel.provider" :items="providers.filter((p: any) => p.enabled).map((p: any) => ({ label: p.label, value: p.type }))" />
            </UFormField>
            <UFormField label="Model ID" required>
              <UInput v-model="newModel.modelId" placeholder="e.g. gpt-4o" />
            </UFormField>
            <UFormField label="Display Name">
              <UInput v-model="newModel.displayName" placeholder="e.g. GPT-4o" />
            </UFormField>
            <UFormField label="Context Types">
              <USelect v-model="newModel.contextTypes" :items="['chat', 'embedding', 'intent', 'stt', 'tts']" multiple />
            </UFormField>
            <UFormField label="Priority">
              <UInput v-model.number="newModel.priority" type="number" placeholder="0" />
            </UFormField>
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
              <UButton color="neutral" variant="outline" class="active:scale-97 transition-transform" @click="showAddModelDialog = false">Cancel</UButton>
              <UButton color="primary" class="active:scale-97 transition-transform" @click="addModel">Add Model</UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
