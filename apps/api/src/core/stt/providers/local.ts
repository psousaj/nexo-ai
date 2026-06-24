import { exec, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { STTProvider, STTTranscribeOptions } from '../types';

const pExec = promisify(exec);
const pExecFile = promisify(execFile);

function shq(s: string): string {
	return `'${s.replace(/'/g, "'\\''")}'`;
}

function findWhisperBinary(): string | null {
	// 1. Env var explícito tem prioridade
	if (process.env.LOCAL_WHISPER_BINARY) {
		if (existsSync(process.env.LOCAL_WHISPER_BINARY)) {
			return process.env.LOCAL_WHISPER_BINARY;
		}
		return null;
	}

	// 2. Tenta detectar whisper-cpp ou faster-whisper no PATH (sync, chamado do getter)
	try {
		const { stdout } = require('node:child_process').execSync(
			'command -v whisper-cpp 2>/dev/null || command -v faster-whisper 2>/dev/null || command -v whisper 2>/dev/null',
			{ encoding: 'utf-8', timeout: 5000 },
		);
		return stdout.trim() || null;
	} catch {
		return null;
	}
}

/**
 * Extrai texto da transcrição do stdout do whisper-cpp.
 * Formato: [00:00:00.000 --> 00:00:10.500]   texto da transcrição
 * Filtra apenas linhas com timestamp (ignora logs/diagnóstico) e extrai o texto.
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

export function createLocalProvider(): STTProvider {
	let binaryPath: string | null = null;

	return {
		name: 'local',

		get isAvailable(): boolean {
			if (binaryPath !== null) return true;
			binaryPath = findWhisperBinary();
			return binaryPath !== null;
		},

		async transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null> {
			if (!binaryPath) return null;

			const ext = options?.filename?.split('.').pop() || 'ogg';
			const tmpDir = await mkdtemp(join(tmpdir(), 'nexo-stt-'));
			const inputFile = join(tmpDir, `audio.${ext}`);

			try {
				// Escreve áudio em arquivo temporário
				await writeFile(inputFile, Buffer.from(audioBase64, 'base64'));

				// Detecta qual binário e constrói comando
				const binaryName = binaryPath.split('/').pop() || '';
				const isFasterWhisper = binaryName.includes('faster-whisper') || binaryName === 'faster_whisper';

				if (isFasterWhisper) {
					// faster-whisper: python -m faster_whisper input_file --output_dir tmp_dir
					const model = process.env.LOCAL_WHISPER_MODEL || 'base';
					const command = `python3 -m faster_whisper ${shq(inputFile)} --model ${shq(model)} --output_dir ${shq(tmpDir)}${options?.languageHint ? ` --language ${shq(options.languageHint)}` : ''}`;
					await pExec(command, { timeout: 120_000 });

					// faster-whisper escreve arquivo .txt no output_dir
					const txtFile = join(tmpDir, `${inputFile.split('/').pop()}.txt`);
					try {
						const text = (await readFile(txtFile, 'utf-8')).trim();
						if (text) return text;
					} catch {
						return null;
					}
				} else {
					// whisper-cpp: usa stdout em vez de arquivo
					// sem --output-txt: não escreve .txt, transcrição vai pro stdout
					const modelPath = process.env.LOCAL_WHISPER_MODEL_PATH || './models/ggml-base.bin';
					const args = ['-m', modelPath, '-f', inputFile];
					if (options?.languageHint) {
						args.push('-l', options.languageHint);
					}
					const { stdout } = await pExecFile(binaryPath, args, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
					const text = parseWhisperStdout(stdout);
					if (text) return text;
				}

				return null;
			} catch {
				return null;
			} finally {
				// cleanup assíncrono — fogo e esquece
				rm(tmpDir, { recursive: true, force: true }).catch(() => {});
			}
		},
	};
}
