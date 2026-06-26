import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { loggers } from '@/utils/logger';

import type { STTProvider, STTTranscribeOptions } from '../types';

const pExecFile = promisify(execFile);
const log = loggers.enrichment;

/**
 * Extrai texto da transcrição do stdout do whisper-cpp.
 * Formato: [00:00:00.000 --> 00:00:10.500]   texto da transcrição
 * Filtra apenas linhas com timestamp (ignora logs/diagnóstico) e extrai o texto.
 * Mantido para compatibilidade com testes existentes.
 */
const TIMESTAMP_LINE = /^\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/;

export function parseWhisperStdout(stdout: string): string {
	return stdout
		.split('\n')
		.filter((line) => TIMESTAMP_LINE.test(line))
		.map((line) => line.replace(TIMESTAMP_LINE, '').trim())
		.filter(Boolean)
		.join(' ');
}

/**
 * Resolve o caminho do script faster-transcribe.py.
 * Prioridade: env var → relativo ao arquivo atual → cwd → null.
 */
function resolveTranscribeScript(): string | null {
	// 1. Env var explícito (usado no Docker)
	if (process.env.LOCAL_WHISPER_BINARY) {
		if (existsSync(process.env.LOCAL_WHISPER_BINARY)) {
			return process.env.LOCAL_WHISPER_BINARY;
		}
		log.warn({ path: process.env.LOCAL_WHISPER_BINARY }, 'LOCAL_WHISPER_BINARY set but not found');
		return null;
	}

	// 2. Tenta achar o script relativo a este arquivo (dev)
	try {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		const resolved = join(currentDir, '..', '..', '..', '..', 'scripts', 'faster-transcribe.py');
		if (existsSync(resolved)) {
			return resolved;
		}
	} catch {
		// import.meta.url pode falhar em alguns setups
	}

	// 3. Procura no cwd (produção / Docker)
	const cwdScript = join(process.cwd(), 'scripts', 'faster-transcribe.py');
	if (existsSync(cwdScript)) {
		return cwdScript;
	}

	return null;
}

export function createLocalProvider(): STTProvider {
	let scriptPath: string | null = null;

	return {
		name: 'local',

		get isAvailable(): boolean {
			if (scriptPath !== null) return true;
			scriptPath = resolveTranscribeScript();
			return scriptPath !== null;
		},

		async transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null> {
			if (!scriptPath) return null;

			const ext = options?.filename?.split('.').pop() || 'ogg';
			const tmpDir = await mkdtemp(join(tmpdir(), 'nexo-stt-'));
			const inputFile = join(tmpDir, `audio.${ext}`);

			try {
				await writeFile(inputFile, Buffer.from(audioBase64, 'base64'));

				// Monta args: python3 <script> <input> [model] [language]
				const model = process.env.LOCAL_WHISPER_MODEL || 'base';
				const args: string[] = [scriptPath, inputFile, model];
				if (options?.languageHint) {
					args.push(options.languageHint);
				}

				const { stdout } = await pExecFile('python3', args, {
					timeout: 120_000,
					maxBuffer: 10 * 1024 * 1024,
				});

				const text = stdout.trim();
				if (text) {
					return text;
				}

				log.warn({ model, languageHint: options?.languageHint }, 'Local STT returned empty transcription');
				return null;
			} catch (err) {
				log.error({ err, scriptPath, tmpDir }, 'Local STT provider failed');
				return null;
			} finally {
				rm(tmpDir, { recursive: true, force: true }).catch(() => {});
			}
		},
	};
}
