import { defineAbility } from '@casl/ability';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subjects = 'AdminPanel' | 'Analytics' | 'UserContent' | 'PersonalData' | 'all';

export const ability = defineAbility((_can) => {
	// Initial anonymous state
});
