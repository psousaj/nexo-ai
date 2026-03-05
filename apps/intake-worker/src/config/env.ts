import { z } from 'zod';

const workerEnvSchema = z.object({
	PORT: z.coerce.number().int().positive().default(3002),
	INTAKE_WORKER_TOKEN: z.string().optional().default(''),
	MULTIMODAL_AUDIO: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.default('false'),
	MULTIMODAL_IMAGE: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.default('false'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

let cachedWorkerEnv: WorkerEnv | null = null;

export function getWorkerEnv(): WorkerEnv {
	if (cachedWorkerEnv) {
		return cachedWorkerEnv;
	}

	const parsed = workerEnvSchema.safeParse(process.env);

	if (!parsed.success) {
		throw new Error(`Invalid intake-worker env: ${parsed.error.message}`);
	}

	cachedWorkerEnv = parsed.data;
	return parsed.data;
}
