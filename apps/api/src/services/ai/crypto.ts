import { env } from '@/config/env';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function getMasterKey(): Buffer {
	const hex = env.BYOK_ENCRYPTION_KEY;
	if (!hex || hex.length < 64) {
		throw new Error('BYOK_ENCRYPTION_KEY is required (64 hex chars = 32 bytes)');
	}
	return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
	const key = getMasterKey();
	const iv = randomBytes(12);

	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export function decrypt(encoded: string): string {
	const key = getMasterKey();
	const data = Buffer.from(encoded, 'base64');

	const iv = data.subarray(0, 12);
	const authTag = data.subarray(data.length - 16);
	const ciphertext = data.subarray(12, data.length - 16);

	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return decrypted.toString('utf8');
}

export function fingerprint(key: string): string {
	const preview = key.slice(0, 4);
	return createHash('sha256').update(preview).digest('hex').slice(0, 12);
}
