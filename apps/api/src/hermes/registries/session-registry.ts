export interface SessionRegistry {
	load(sessionKey: string): Promise<unknown>;
	save(sessionKey: string, patch: Record<string, unknown>): Promise<void>;
}
