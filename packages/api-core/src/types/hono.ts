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
 * Tipo mínimo de contexto autenticado usado pelo projeto sem depender
 * do pacote hono em tempo de compilação.
 */
export interface AuthenticatedContext {
	get<K extends keyof AuthContext['Variables']>(key: K): AuthContext['Variables'][K];
	set<K extends keyof AuthContext['Variables']>(key: K, value: AuthContext['Variables'][K]): void;
}

/**
 * Helper type para usar em rotas com autenticação
 */
export type AuthenticatedContextLike = AuthenticatedContext;
