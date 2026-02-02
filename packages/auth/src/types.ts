export interface User {
	id: string;
	email: string;
	name?: string;
}

export interface Session {
	user: User;
	accessToken: string;
}
