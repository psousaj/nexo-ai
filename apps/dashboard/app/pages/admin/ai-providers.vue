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
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-black text-gray-900 dark:text-white">AI Providers</h2>
        <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Manage AI providers and configure models.
        </p>
      </div>
    </div>

    <UTabs :items="[
      { label: 'Operação', icon: 'i-heroicons-cog-6-tooth', slot: 'operation' },
      { label: 'Cadastro de Modelos', icon: 'i-heroicons-cube', slot: 'models' }
    ]">
      <template #operation>
        <div v-if="isLoading" class="space-y-4">
          <USkeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" />
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="p in providers"
            :key="p.id"
            class="relative bg-white dark:bg-gray-900 border rounded-xl p-5 transition-shadow hover:shadow-md"
            :class="[p.enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-60']"
          >
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  :class="[
                    `bg-${getProviderMeta(p.type).color}-100 text-${getProviderMeta(p.type).color}-700 dark:bg-${getProviderMeta(p.type).color}-900/30 dark:text-${getProviderMeta(p.type).color}-400`
                  ]"
                >
                  <UIcon :name="getProviderMeta(p.type).icon" class="w-5 h-5" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-900 dark:text-white text-sm">{{ p.label }}</span>
                    <USwitch :model-value="p.enabled" size="xs" @update:model-value="toggleProvider(p)" />
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">{{ p.type }}</span>
                  </div>
                </div>
              </div>
              <UDropdown :items="[
                [{ label: 'Edit', icon: 'i-heroicons-pencil-square', click: () => openEditProvider(p) }],
                [{ label: 'Delete', icon: 'i-heroicons-trash', color: 'error', click: () => deleteProvider(p) }],
              ]">
                <UButton color="neutral" variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
              </UDropdown>
            </div>
            
            <div class="flex gap-2">
              <UButton size="xs" :color="hasKey(p.id) ? 'neutral' : 'primary'" variant="outline" @click="openKeyDialog(p)">
                {{ hasKey(p.id) ? 'Change Key' : 'Set API Key' }}
              </UButton>
              <div class="flex-1" />
              <UButton size="xs" color="neutral" variant="outline" :loading="testing[p.type]" @click="testProvider(p)">Test</UButton>
            </div>
          </div>
        </div>
      </template>

      <template #models>
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 class="font-semibold text-gray-900 dark:text-white">Registered Models</h3>
            <UButton color="primary" size="sm" icon="i-heroicons-plus" @click="showAddModelDialog = true">Add Model</UButton>
          </div>
          <div class="px-5 py-3 border-b">
            <UInput v-model="searchQuery" placeholder="Search models..." icon="i-heroicons-magnifying-glass" size="sm" />
          </div>
          <UTable :data="filteredModels" :columns="modelColumns">
            <template #contextTypes-cell="{ row }">
              <UBadge v-for="ctx in row.original.contextTypes" :key="ctx" size="xs" variant="subtle">{{ ctx }}</UBadge>
            </template>
            <template #enabled-cell="{ row }">
              <USwitch :model-value="row.original.enabled" size="xs" @update:model-value="toggleModel(row.original)" />
            </template>
            <template #actions-cell="{ row }">
              <UButton color="error" variant="ghost" size="xs" icon="i-heroicons-trash" @click="deleteModel(row.original.id)" />
            </template>
          </UTable>
        </div>
      </template>
    </UTabs>

    <!-- Add Provider Dialog -->
    <UModal v-model:open="showAddProviderDialog">
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
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showAddProviderDialog = false">Cancel</UButton>
            <UButton color="primary" @click="addProvider">Add Provider</UButton>
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- Edit Provider Dialog -->
    <UModal v-model:open="showEditProviderDialog">
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
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showEditProviderDialog = false">Cancel</UButton>
            <UButton color="primary" @click="saveEditProvider">Save</UButton>
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- API Key Dialog -->
    <UModal v-model:open="showKeyDialog">
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
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showKeyDialog = false">Cancel</UButton>
            <UButton color="primary" @click="saveKey">Save Key</UButton>
          </div>
        </div>
      </UCard>
    </UModal>

    <!-- Add Model Dialog -->
    <UModal v-model:open="showAddModelDialog">
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
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showAddModelDialog = false">Cancel</UButton>
            <UButton color="primary" @click="addModel">Add</UButton>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
