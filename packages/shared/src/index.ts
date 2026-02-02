import { z } from 'zod';

export const ExampleSchema = z.object({
	name: z.string(),
});

export type ExampleType = z.infer<typeof ExampleSchema>;
