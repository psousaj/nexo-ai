<script setup lang="ts">
const route = useRoute();
const config = useRuntimeConfig();

const queryToken = route.query.token ?? route.query.code;
const token = Array.isArray(queryToken) ? queryToken[0] : queryToken;

onMounted(async () => {
	if (typeof token === 'string' && token.trim().length > 0) {
		const confirmUrl = new URL(`${config.public.apiUrl}/emails/confirm`);
		confirmUrl.searchParams.set('token', token);
		window.location.assign(confirmUrl.toString());
		return;
	}

	await navigateTo('/', { replace: true });
});
</script>

<template>
	<div />
</template>
