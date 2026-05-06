import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api from '~/utils/api';

interface ProviderEntry {
	id: number;
	type: string;
	label: string;
	enabled: boolean;
	available: boolean;
	priority: number;
	config: Record<string, string>;
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

interface KeyEntry {
	provider: string;
	fingerprint: string | null;
	config: Record<string, string>;
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

	const keysQuery = () =>
		useQuery({
			queryKey: ['ai', 'keys'],
			queryFn: () => api.get('/admin/ai/keys').then((r) => r.data),
		});

	const addProviderMutation = useMutation({
		mutationFn: (data: { type: string; label: string; priority?: number; config?: Record<string, string> }) =>
			api.post('/admin/ai/providers', data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
		},
	});

	const updateProviderMutation = useMutation({
		mutationFn: ({ id, ...data }: { id: number; label?: string; enabled?: boolean; priority?: number; config?: Record<string, string> }) =>
			api.patch(`/admin/ai/providers/${id}`, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
			queryClient.invalidateQueries({ queryKey: ['ai', 'keys'] });
		},
	});

	const deleteProviderMutation = useMutation({
		mutationFn: (id: number) => api.delete(`/admin/ai/providers/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
			queryClient.invalidateQueries({ queryKey: ['ai', 'keys'] });
		},
	});

	const addModelMutation = useMutation({
		mutationFn: (data: Partial<Model>) => api.post('/admin/ai/models', data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ai', 'models'] });
			queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
		},
	});

	const updateModelMutation = useMutation({
		mutationFn: ({ id, ...data }: { id: number } & Partial<Model>) => api.patch(`/admin/ai/models/${id}`, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ai', 'models'] });
			queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
		},
	});

	const deleteModelMutation = useMutation({
		mutationFn: (id: number) => api.delete(`/admin/ai/models/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ai', 'models'] });
			queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
		},
	});

	const testProviderMutation = useMutation({
		mutationFn: ({ type, providerId }: { type: string; providerId: number }) =>
			api.post(`/admin/ai/test/${type}`),
	});

	const setKeyMutation = useMutation({
		mutationFn: (data: { provider: string; key: string; config?: Record<string, string> }) =>
			api.post(`/admin/ai/keys/${data.provider}`, { key: data.key, config: data.config }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai', 'keys'] }),
	});

	const deleteKeyMutation = useMutation({
		mutationFn: (provider: string) => api.delete(`/admin/ai/keys/${provider}`),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai', 'keys'] }),
	});

	return {
		providersQuery,
		modelsQuery,
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
	};
}
