import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import api from '~/utils/api';

interface Provider {
  type: string;
  enabled: boolean;
  available: boolean;
  label: string;
}

interface Model {
  id: number;
  provider: string;
  modelId: string;
  displayName: string | null;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  contextTypes: string[];
}

export function useAiProviders() {
  const queryClient = useQueryClient();

  const providersQuery = () =>
    useQuery({
      queryKey: ['ai', 'providers'],
      queryFn: () => api.get('/admin/ai/providers').then((r) => r.data),
    });

  const modelsQuery = (params?: { provider?: string; context?: string; q?: string }) =>
    useQuery({
      queryKey: ['ai', 'models', params],
      queryFn: () => api.get('/admin/ai/models', { params }).then((r) => r.data),
    });

  const addModelMutation = useMutation({
    mutationFn: (data: Partial<Model>) => api.post('/admin/ai/models', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai', 'models'] }),
  });

  const updateModelMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Model>) =>
      api.patch(`/admin/ai/models/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai', 'models'] }),
  });

  const deleteModelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/ai/models/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai', 'models'] }),
  });

  const testProviderMutation = useMutation({
    mutationFn: (type: string) => api.post(`/admin/ai/test/${type}`),
  });

  return {
    providersQuery,
    modelsQuery,
    addModelMutation,
    updateModelMutation,
    deleteModelMutation,
    testProviderMutation,
  };
}
