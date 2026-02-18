import type { Context } from 'hono';

/**
 * Estende o Context do Hono para incluir variáveis customizadas
 * definidas pelo authMiddleware
 */
export type AuthContext = {
	Variables: {
		user: {
			id: string;
			name: string;
			email: string;
		};
		session: {
			id: string;
			userId: string;
			expiresAt: Date;
		};
	};
};

/**
 * Helper type para usar em rotas com autenticação
 */
export type AuthenticatedContext = Context<AuthContext>;
