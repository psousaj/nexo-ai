export interface User {
	id: string;
	email: string;
	name?: string;
	role?: string;
	image?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Session {
	user: User;
	token: string;
	expiresAt: Date;
}
