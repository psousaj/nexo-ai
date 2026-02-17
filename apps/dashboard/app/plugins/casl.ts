import { defineAbility } from '@casl/ability';
import { abilitiesPlugin } from '@casl/vue';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subjects = 'AdminPanel' | 'Analytics' | 'UserContent' | 'PersonalData' | 'all';

export const ability = defineAbility((_can) => {
	// Initial anonymous state
});

export default defineNuxtPlugin((nuxtApp) => {
	nuxtApp.vueApp.use(abilitiesPlugin, ability, {
		useGlobalProperties: true,
	});
});
