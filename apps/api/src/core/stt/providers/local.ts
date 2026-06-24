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
				} else {
					// whisper-cpp: ./whisper-cpp -m model.bin -f input_file --output-txt
					// Nota: --output-dir não existe no whisper-cpp v1.9.1
					// O .txt é gerado no mesmo diretório do input como {inputFile}.txt
					const modelPath = process.env.LOCAL_WHISPER_MODEL_PATH || './models/ggml-base.bin';
					const args = ['-m', modelPath, '-f', inputFile, '--output-txt'];
					if (options?.languageHint) {
						args.push('-l', options.languageHint);
					}
					await pExecFile(binaryPath, args, { timeout: 120_000 });
				}

				// Tenta ler resultado — whisper-cpp gera {inputFile}.txt, faster-whisper gera {input}.txt
				const outputCandidates = [`${inputFile}.txt`];

				for (const candidate of outputCandidates) {
					try {
						const text = (await readFile(candidate, 'utf-8')).trim();
						if (text) return text;
					} catch {
						// arquivo não existe ou não pode ser lido
					}
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
