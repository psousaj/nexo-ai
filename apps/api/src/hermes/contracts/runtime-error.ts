export class HermesRuntimeError extends Error {
	constructor(
		public code: string,
		message: string,
	) {
		super(message);
		this.name = 'HermesRuntimeError';
	}
}
