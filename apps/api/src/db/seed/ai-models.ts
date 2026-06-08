import { db, initializeDatabase } from '@/db';
import { modelRegistry } from '@/db/schema/model-registry';

initializeDatabase();

const defaultModels = [
	// Cloudflare
	{
		provider: 'cloudflare',
		modelId: '@cf/meta/llama-4-scout-17b-16e-instruct',
		displayName: 'Llama 4 Scout',
		enabled: true,
		priority: 10,
		isDefault: true,
		contextTypes: ['chat', 'intent'],
	},
	{
		provider: 'cloudflare',
		modelId: '@cf/baai/bge-base-en-v1.5',
		displayName: 'BGE Base Embedding',
		enabled: true,
		priority: 10,
		isDefault: true,
		contextTypes: ['embedding'],
	},
	// OpenAI
	{
		provider: 'openai',
		modelId: 'gpt-4o',
		displayName: 'GPT-4o',
		enabled: true,
		priority: 20,
		contextTypes: ['chat', 'intent'],
	},
	{
		provider: 'openai',
		modelId: 'gpt-4o-mini',
		displayName: 'GPT-4o Mini',
		enabled: true,
		priority: 15,
		contextTypes: ['chat', 'intent'],
	},
	{
		provider: 'openai',
		modelId: 'text-embedding-3-small',
		displayName: 'Text Embedding 3 Small',
		enabled: true,
		priority: 20,
		contextTypes: ['embedding'],
	},
	// DeepSeek
	{
		provider: 'deepseek',
		modelId: 'deepseek-chat',
		displayName: 'DeepSeek V3',
		enabled: true,
		priority: 5,
		contextTypes: ['chat', 'intent'],
	},
];

async function seedAiModels() {
	for (const model of defaultModels) {
		await db.insert(modelRegistry).values(model).onConflictDoNothing();
	}
	console.log('✅ AI models seeded');
}

seedAiModels().catch(console.error);
