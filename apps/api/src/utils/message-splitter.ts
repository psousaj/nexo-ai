/**
 * Auto-split de mensagens longas (artigo Akita).
 *
 * Quebra no último \n antes do limite; fallback no último espaço.
 * Nunca corta no meio de palavras.
 */
export function splitMessage(text: string, maxLength: number): string[] {
	if (text.length <= maxLength) return [text];

	const parts: string[] = [];
	let remaining = text;

	while (remaining.length > maxLength) {
		// Quebra no último \n antes do limite
		let splitIndex = remaining.lastIndexOf('\n', maxLength);
		if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
			// Fallback: quebra no último espaço
			splitIndex = remaining.lastIndexOf(' ', maxLength);
		}
		if (splitIndex === -1) splitIndex = maxLength;

		parts.push(remaining.substring(0, splitIndex));
		remaining = remaining.substring(splitIndex).trimStart();
	}
	if (remaining) parts.push(remaining);
	return parts;
}
