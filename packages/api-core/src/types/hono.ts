/**
 * Framework-agnostic type representing authenticated user data
 * Used to document the shape of user/session injected by auth middleware
 */
export type AuthUser = {
	id: string;
	name: string;
	email: string;
	role?: string;
};

export type AuthSession = {
	id: string;
	userId: string;
	expiresAt: Date;
};

/**
 * Context variable shape injected by auth middleware (framework-agnostic)
 */
export type AuthContext = {
	user: AuthUser;
	session: AuthSession;
};
