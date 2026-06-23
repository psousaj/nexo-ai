import { execSync } from 'child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { STTProvider, STTTranscribeOptions } from '../types';

function findWhisperBinary(): string | null {
	// 1. Env var explícito tem prioridade
	if (process.env.LOCAL_WHISPER_BINARY) {
		if (existsSync(process.env.LOCAL_WHISPER_BINARY)) {
			return process.env.LOCAL_WHISPER_BINARY;
		}
		return null;
	}

	// 2. Tenta detectar whisper-cpp ou faster-whisper no PATH
	try {
		const result = execSync(
			'command -v whisper-cpp 2>/dev/null || command -v faster-whisper 2>/dev/null || command -v whisper 2>/dev/null',
			{ encoding: 'utf-8', timeout: 5000 },
		).trim();
		return result || null;
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
			const tmpDir = mkdtempSync(join(tmpdir(), 'nexo-stt-'));
			const inputFile = join(tmpDir, `audio.${ext}`);

			try {
				// Escreve áudio em arquivo temporário
				writeFileSync(inputFile, Buffer.from(audioBase64, 'base64'));

				// Detecta qual binário e constrói comando
				const binaryName = binaryPath.split('/').pop() || '';
				const isFasterWhisper = binaryName.includes('faster-whisper') || binaryName === 'faster_whisper';

				let command: string;
				if (isFasterWhisper) {
					// faster-whisper: python -m faster_whisper input_file --output_dir tmp_dir
					const model = process.env.LOCAL_WHISPER_MODEL || 'base';
					const language = options?.languageHint ? ` --language ${options.languageHint}` : '';
					command = `python3 -m faster_whisper "${inputFile}" --model "${model}" --output_dir "${tmpDir}"${language}`;
				} else {
					// whisper-cpp: ./whisper-cpp -m model.bin -f input_file --output-txt
					const modelPath = process.env.LOCAL_WHISPER_MODEL_PATH || './models/ggml-base.bin';
					const language = options?.languageHint ? ` -l ${options.languageHint}` : '';
					command = `"${binaryPath}" -m "${modelPath}" -f "${inputFile}" --output-txt --output-dir "${tmpDir}"${language}`;
				}

				execSync(command, { timeout: 120_000, encoding: 'utf-8' });

				// Tenta ler resultado — whisper-cpp gera {input}.txt, faster-whisper gera {input}.txt
				const stem = inputFile.replace(/\.\w+$/, '');
				const outputCandidates = [
					`${stem}.txt`,
					`${inputFile}.txt`,
					join(tmpDir, `${inputFile.split('/').pop()}.txt`),
				];

				for (const candidate of outputCandidates) {
					if (existsSync(candidate)) {
						const text = readFileSync(candidate, 'utf-8').trim();
						if (text) return text;
					}
				}

				return null;
			} catch {
				return null;
			} finally {
				try {
					if (existsSync(inputFile)) unlinkSync(inputFile);
					// Limpa arquivos de saída
					const stem = inputFile.replace(/\.\w+$/, '');
					for (const candidate of [`${stem}.txt`, `${inputFile}.txt`, join(tmpDir, `${inputFile.split('/').pop()}.txt`)]) {
						if (existsSync(candidate)) unlinkSync(candidate);
					}
					rmdirSync(tmpDir);
				} catch {
					// cleanup silencioso
				}
			}
		},
	};
}
