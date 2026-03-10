/**
 * Módulo de Treinamento NEXO
 *
 * Este módulo é responsável por treinar o modelo neural do NEXO
 * usando nlp.js com suporte opcional a BERT embeddings.
 *
 * USO:
 *   pnpm train:nexo           # Treina com neural padrão
 *   pnpm train:nexo --bert    # Treina com BERT embeddings
 *
 * O modelo treinado é salvo em:
 *   src/services/message-analysis/training/model/nexo-model.nlp
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loggers } from '@/utils/logger';
// @ts-ignore — node-nlp has no type declarations
import { NlpManager } from 'node-nlp';
import { NEXO_ENTITIES, NEXO_RESPONSES, NEXO_TRAINING_DATA } from './training-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TrainerConfig {
	/** Usar BERT embeddings (mais preciso, mas mais lento) */
	useBert?: boolean;
	/** Número de épocas de treinamento */
	epochs?: number;
	/** Taxa de aprendizado */
	learningRate?: number;
	/** Log de progresso do treinamento */
	log?: boolean;
	/** Caminho para salvar o modelo */
	modelPath?: string;
}

function resolveDefaultModelPath(): string {
	if (process.env.NEXO_MODEL_PATH?.trim()) {
		return process.env.NEXO_MODEL_PATH.trim();
	}

	const srcModelPath = path.join(
		process.cwd(),
		'apps',
		'api',
		'src',
		'services',
		'message-analysis',
		'training',
		'model',
		'nexo-model.nlp',
	);
	const bundledModelPath = path.join(__dirname, 'model', 'nexo-model.nlp');

	if (fs.existsSync(srcModelPath)) {
		return srcModelPath;
	}

	return bundledModelPath;
}

const DEFAULT_CONFIG: TrainerConfig = {
	useBert: false,
	epochs: 100,
	learningRate: 0.1,
	log: true,
	modelPath: resolveDefaultModelPath(),
};

/**
 * Classe responsável pelo treinamento do modelo NEXO
 */
export class NexoTrainer {
	private manager: NlpManager;
	private config: TrainerConfig;

	constructor(config: Partial<TrainerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };

		// Configurar NlpManager
		const managerConfig: any = {
			languages: ['pt'],
			forceNER: true,
			autoSave: false,
			autoLoad: false,
			nlu: {
				log: this.config.log,
				useNoneFeature: true,
			},
		};

		// Adicionar configuração BERT se habilitado
		if (this.config.useBert) {
			managerConfig.bert = {
				enabled: true,
				modelPath: 'bert-base-multilingual-cased',
			};
			this.log('🧠 BERT embeddings habilitado');
		}

		this.manager = new NlpManager(managerConfig);
	}

	getModelPath(): string {
		return this.config.modelPath!;
	}

	hasModelFile(): boolean {
		return fs.existsSync(this.config.modelPath!);
	}

	private log(message: string): void {
		if (this.config.log) {
			loggers.nlp.info(message);
		}
	}

	/**
	 * Adiciona documentos de treinamento ao manager
	 */
	private addTrainingDocuments(): void {
		this.log('📝 Adicionando documentos de treinamento...');

		let totalExamples = 0;

		for (const intentData of NEXO_TRAINING_DATA) {
			// Adicionar exemplos
			for (const example of intentData.examples) {
				this.manager.addDocument('pt', example, intentData.intent);
				totalExamples++;
			}

			// Adicionar respostas se existirem
			if (intentData.answers) {
				for (const answer of intentData.answers) {
					this.manager.addAnswer('pt', intentData.intent, answer);
				}
			}
		}

		// Adicionar respostas extras do NEXO_RESPONSES
		for (const [intent, responses] of Object.entries(NEXO_RESPONSES)) {
			for (const response of responses) {
				this.manager.addAnswer('pt', intent, response);
			}
		}

		this.log(`✅ ${totalExamples} exemplos adicionados`);
	}

	/**
	 * Adiciona entidades nomeadas
	 */
	private addNamedEntities(): void {
		this.log('🏷️ Adicionando entidades nomeadas...');

		for (const [entityName, values] of Object.entries(NEXO_ENTITIES)) {
			for (const entity of values) {
				// Adicionar valor principal
				this.manager.addNamedEntityText(entityName, entity.value, ['pt'], [entity.value]);

				// Adicionar sinônimos
				for (const synonym of entity.synonyms) {
					this.manager.addNamedEntityText(entityName, entity.value, ['pt'], [synonym]);
				}
			}
		}

		this.log(`✅ ${Object.keys(NEXO_ENTITIES).length} categorias de entidades adicionadas`);
	}

	/**
	 * Treina o modelo
	 */
	async train(): Promise<void> {
		this.log('🚀 Iniciando treinamento do modelo NEXO...');
		const startTime = Date.now();

		// Adicionar documentos e entidades
		this.addTrainingDocuments();
		this.addNamedEntities();

		// Treinar
		this.log('🔄 Treinando rede neural...');
		await this.manager.train();

		const trainingTime = Date.now() - startTime;
		this.log(`✅ Treinamento concluído em ${trainingTime}ms`);

		// Salvar modelo
		await this.save();
	}

	/**
	 * Salva o modelo treinado
	 */
	async save(): Promise<void> {
		// Garantir que o diretório existe
		const modelDir = path.dirname(this.config.modelPath!);
		if (!fs.existsSync(modelDir)) {
			try {
				fs.mkdirSync(modelDir, { recursive: true });
			} catch (error) {
				const err = error as NodeJS.ErrnoException;
				throw new Error(`Falha ao criar diretório do modelo (${modelDir}): ${err.code || err.message}`);
			}
		}

		this.manager.save(this.config.modelPath);
		this.log(`💾 Modelo salvo em: ${this.config.modelPath}`);
	}

	/**
	 * Carrega modelo existente
	 */
	async load(): Promise<boolean> {
		if (this.hasModelFile()) {
			this.manager.load(this.config.modelPath);
			this.log(`📂 Modelo carregado de: ${this.config.modelPath}`);
			return true;
		}
		return false;
	}

	/**
	 * Processa uma mensagem usando o modelo treinado
	 */
	async process(message: string): Promise<any> {
		return this.manager.process('pt', message);
	}

	/**
	 * Testa o modelo com exemplos
	 */
	async test(): Promise<void> {
		this.log('\n🧪 Testando modelo...\n');

		const testCases = [
			'oi',
			'salva inception',
			'quero assistir breaking bad',
			'mostra meus filmes',
			'apaga tudo',
			'sim',
			'não, cancela',
			'qual seu nome',
			'anota: comprar pão',
			'deleta o primeiro',
		];

		for (const testCase of testCases) {
			const result = await this.process(testCase);
			loggers.ai.info(`📨 "${testCase}"`);
			loggers.ai.info(`   → Intent: ${result.intent} (${(result.score * 100).toFixed(1)}%)`);
			if (result.entities?.length > 0) {
				loggers.ai.info(`   → Entities: ${JSON.stringify(result.entities)}`);
			}
			if (result.answer) {
				loggers.ai.info(`   → Answer: ${result.answer}`);
			}
			loggers.ai.info('');
		}
	}

	/**
	 * Retorna o NlpManager para uso externo
	 */
	getManager(): NlpManager {
		return this.manager;
	}
}

// Script de treinamento CLI - ESM compatible
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
	const useBert = process.argv.includes('--bert');

	const trainer = new NexoTrainer({ useBert, log: true });

	(async () => {
		loggers.ai.info('\n🤖 NEXO NLP Trainer\n');
		loggers.ai.info('==================\n');

		await trainer.train();
		await trainer.test();

		loggers.ai.info('✨ Pronto! O modelo está treinado e salvo.\n');
	})();
}
