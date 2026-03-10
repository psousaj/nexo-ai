import { instrumentService } from '@/services/service-instrumentation';
import type { ImageMetadata } from '@/types';
import { loggers } from '@/utils/logger';

class ImageMetadataService {
	/**
	 * Extrai metadados básicos de uma imagem via HEAD request.
	 * EXIF completo requer o pacote `exifreader` (adicionar quando necessário).
	 */
	async extractMetadata(url: string): Promise<ImageMetadata | null> {
		try {
			// HEAD request para obter content-type e content-length sem baixar a imagem
			const headRes = await fetch(url, {
				method: 'HEAD',
				signal: AbortSignal.timeout(8000),
			});

			if (!headRes.ok) {
				loggers.app.warn({ url, status: headRes.status }, '🖼️ Falha ao obter HEAD da imagem');
				return null;
			}

			const contentType = headRes.headers.get('content-type') ?? '';
			const contentLength = headRes.headers.get('content-length');

			const format = this.parseFormat(contentType);
			const sizeBytes = contentLength ? Number(contentLength) : undefined;
			const sourceDomain = this.extractDomain(url);

			const metadata: ImageMetadata = {
				url,
				source_domain: sourceDomain,
				format,
				size_bytes: sizeBytes,
			};

			return metadata;
		} catch (error) {
			loggers.app.error({ err: error, url }, '🖼️ Erro ao extrair metadados da imagem');
			return null;
		}
	}

	private parseFormat(contentType: string): string | undefined {
		const map: Record<string, string> = {
			'image/jpeg': 'jpeg',
			'image/jpg': 'jpeg',
			'image/png': 'png',
			'image/gif': 'gif',
			'image/webp': 'webp',
			'image/svg+xml': 'svg',
			'image/avif': 'avif',
			'image/heic': 'heic',
		};
		return map[contentType.toLowerCase().split(';')[0].trim()];
	}

	private extractDomain(url: string): string | undefined {
		try {
			return new URL(url).hostname;
		} catch {
			return undefined;
		}
	}
}

export const imageMetadataService = instrumentService('image-metadata', new ImageMetadataService());
