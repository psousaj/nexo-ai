/**
 * Toast notification composable
 * Simple notification system for dashboard
 */

export const useToast = () => {
	const show = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
		// Simple alert-based implementation for now
		// TODO: Replace with proper toast library (vue-toastification, notivue, etc.)
		if (type === 'error') {
			console.error('❌', message);
		} else if (type === 'success') {
			console.log('✅', message);
		} else {
			console.log('ℹ️', message);
		}
	};

	const success = (message: string) => show(message, 'success');
	const error = (message: string) => show(message, 'error');
	const info = (message: string) => show(message, 'info');

	return {
		show,
		success,
		error,
		info,
	};
};
