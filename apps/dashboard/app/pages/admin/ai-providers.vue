<script setup lang="ts">
definePageMeta({
  middleware: ['role'],
  layout: 'default',
});

const toast = useToast();
const searchQuery = ref('');
const showAddDialog = ref(false);
const testing = ref<Record<string, boolean>>({});
const newModel = ref({
  provider: 'openai',
  modelId: '',
  displayName: '',
  contextTypes: ['chat'],
  priority: 0,
});

const {
  providersQuery,
  addModelMutation,
  updateModelMutation,
  deleteModelMutation,
  testProviderMutation,
} = useAiProviders();

const { data: providersData, isLoading } = providersQuery();

const providers = computed(() => providersData.value?.providers ?? []);

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

async function testProvider(type: string) {
  testing.value[type] = true;
  try {
    await testProviderMutation.mutateAsync(type);
    toast.add({
      title: 'Connection successful',
      description: `${type} provider is reachable.`,
      color: 'success',
      icon: 'i-heroicons-check-circle',
    });
  } catch {
    toast.add({
      title: 'Connection failed',
      description: `Could not reach ${type} provider.`,
      color: 'error',
      icon: 'i-heroicons-x-circle',
    });
  } finally {
    testing.value[type] = false;
  }
}

async function toggleModel(row: any) {
  await updateModelMutation.mutateAsync({ id: row.id, enabled: !row.enabled });
}

async function addModel() {
  await addModelMutation.mutateAsync(newModel.value);
  showAddDialog.value = false;
  newModel.value = { provider: 'openai', modelId: '', displayName: '', contextTypes: ['chat'], priority: 0 };
  toast.add({
    title: 'Model added',
    description: 'The AI model has been registered.',
    color: 'success',
    icon: 'i-heroicons-check-circle',
  });
}

async function deleteModel(id: number) {
  await deleteModelMutation.mutateAsync(id);
  toast.add({
    title: 'Model removed',
    description: 'The AI model has been deleted.',
    color: 'success',
    icon: 'i-heroicons-check-circle',
  });
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-3xl font-black text-gray-900 dark:text-white">
        AI Providers
      </h2>
      <p class="text-gray-600 dark:text-gray-400 mt-1">
        Manage AI providers and configure models for the assistant.
      </p>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <USkeleton v-for="i in 3" :key="i" class="h-32" />
    </div>

    <template v-else>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-gray-600" />
            <h2 class="text-xl font-semibold">Providers</h2>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div v-for="p in providers" :key="p.type" class="border rounded-lg p-4">
            <div>
              <div class="flex items-center gap-2">
                <UIcon :name="`i-simple-icons-${p.type}`" class="w-5 h-5" />
                <span class="text-lg font-medium">{{ p.label }}</span>
                <UBadge
                  v-if="p.enabled && p.available"
                  color="success"
                  variant="subtle"
                  size="xs"
                >Connected</UBadge>
                <UBadge
                  v-else-if="p.enabled"
                  color="warning"
                  variant="subtle"
                  size="xs"
                >Not configured</UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="xs">Disabled</UBadge>
              </div>
              <p class="text-sm text-gray-500 mt-1">{{ p.type }}</p>
            </div>
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              class="mt-3"
              :loading="testing[p.type]"
              @click="testProvider(p.type)"
            >
              Test Connection
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between w-full">
            <h2 class="text-lg font-semibold">Models</h2>
            <UButton color="primary" @click="showAddDialog = true">+ Add Model</UButton>
          </div>
        </template>

        <div class="mb-4">
          <UInput v-model="searchQuery" placeholder="Search models..." icon="i-heroicons-magnifying-glass" />
        </div>

        <UTable :data="filteredModels" :columns="modelColumns">
          <template #contextTypes-cell="{ row }">
            <div class="flex gap-1 flex-wrap">
              <UBadge v-for="ctx in (row.original as any).contextTypes" :key="ctx" size="xs" variant="subtle">
                {{ ctx }}
              </UBadge>
            </div>
          </template>
          <template #enabled-cell="{ row }">
            <USwitch
              :model-value="(row.original as any).enabled"
              @update:model-value="toggleModel(row.original)"
            />
          </template>
          <template #actions-cell="{ row }">
            <UButton
              color="error"
              variant="ghost"
              size="xs"
              icon="i-heroicons-trash"
              @click="deleteModel((row.original as any).id)"
            />
          </template>
        </UTable>
      </UCard>
    </template>

    <UModal v-model:open="showAddDialog">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Add Model</h3>
        </template>
        <div class="space-y-4">
          <UFormField label="Provider" required>
            <USelect v-model="newModel.provider" :items="['cloudflare', 'openai', 'deepseek']" />
          </UFormField>
          <UFormField label="Model ID" required>
            <UInput v-model="newModel.modelId" placeholder="e.g. gpt-4o" />
          </UFormField>
          <UFormField label="Display Name">
            <UInput v-model="newModel.displayName" placeholder="e.g. GPT-4o" />
          </UFormField>
          <UFormField label="Context Types">
            <USelect
              v-model="newModel.contextTypes"
              :items="['chat', 'embedding', 'intent', 'stt', 'tts']"
              multiple
            />
          </UFormField>
          <UFormField label="Priority">
            <UInput v-model.number="newModel.priority" type="number" />
          </UFormField>
          <div class="flex justify-end gap-2 mt-4">
            <UButton color="neutral" variant="outline" @click="showAddDialog = false">Cancel</UButton>
            <UButton color="primary" @click="addModel">Add</UButton>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
