export interface DispatchPayload {
	deliveryMethod: string;
	text: string;
	providerName: string;
}

export class OutgoingGateway {
	constructor(
		private deps: {
			dispatch: (payload: DispatchPayload) => Promise<void>;
		},
	) {}

	async send(input: { channel: 'telegram' | 'whatsapp'; response: { mode: 'text' | 'voice'; text: string } }) {
		if (input.response.mode === 'voice') {
			return this.deps.dispatch({
				deliveryMethod: 'send_voice',
				text: input.response.text,
				providerName: input.channel,
			});
		}
		return this.deps.dispatch({
			deliveryMethod: 'send_text',
			text: input.response.text,
			providerName: input.channel,
		});
	}
}
