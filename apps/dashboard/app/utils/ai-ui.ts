
export const PROVIDER_METADATA = {
  cloudflare: {
    label: 'Cloudflare AI Gateway',
    color: 'orange',
    icon: 'i-heroicons-cloud',
    isCloudflare: true,
  },
  openai: {
    label: 'OpenAI',
    color: 'green',
    icon: 'i-heroicons-cpu-chip',
    isCloudflare: false,
  },
  deepseek: {
    label: 'DeepSeek',
    color: 'blue',
    icon: 'i-heroicons-cpu-chip',
    isCloudflare: false,
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    color: 'purple',
    icon: 'i-heroicons-wrench-screwdriver',
    isCloudflare: false,
  },
  unknown: {
    label: 'Unknown',
    color: 'neutral',
    icon: 'i-heroicons-question-mark-circle',
    isCloudflare: false,
  }
} as const;

export const getProviderMeta = (type: string) => PROVIDER_METADATA[type as keyof typeof PROVIDER_METADATA] ?? PROVIDER_METADATA.unknown;
