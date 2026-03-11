/**
 * Scheduler Service
 *
 * Manages reminder scheduling using Bull MQ.
 * Reminders are stored in the database and processed by a delayed queue.
 */

import { type ProviderType, getProvider } from '@/adapters/messaging';
import { BULLMQ_CONNECTION } from '@/config/redis';
import { db } from '@/db';
import { scheduledReminders } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { Queue, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';

const schedulerLogger = loggers.scheduler;

// ============================================================================
// QUEUE SETUP
// ============================================================================

// Usa conexão BullMQ (compatível com Bun e Node.js)

/**
 * Reminder Queue Job Interface
 */
export interface ReminderJob {
	reminderId: string;
	userId: string;
	title: string;
	description?: string;
	provider: ProviderType;
	externalId: string;
}

/**
 * Queue para processamento de lembretes
 */
export const reminderQueue = new Queue<ReminderJob>('reminder-processing', {
	connection: BULLMQ_CONNECTION,
	defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
});

schedulerLogger.info('✅ Queue "reminder-processing" criada');

// ============================================================================
// WORKER - Processa envio de lembretes
// ============================================================================

export const reminderWorker = new Worker<ReminderJob>(
	'reminder-processing',
	async (job) => {
		const { reminderId, userId, title, description, provider: providerName, externalId } = job.data;

		try {
			schedulerLogger.info({ reminderId, userId, provider: providerName, externalId }, '🔔 [Worker] Enviando lembrete');

			// Check if reminder is still pending
			const [reminder] = await db.select().from(scheduledReminders).where(eq(scheduledReminders.id, reminderId)).limit(1);

			if (!reminder) {
				schedulerLogger.warn({ reminderId }, '⚠️ Lembrete não encontrado');
				return { success: false, reason: 'not_found' };
			}

			if (reminder.status !== 'pending') {
				schedulerLogger.info({ reminderId, status: reminder.status }, '⚠️ Lembrete não está mais pendente');
				return { success: false, reason: 'not_pending' };
			}

			// Build reminder message
			const message = `🔔 **Lembrete**\n\n**${title}**${description ? `\n\n${description}` : ''}`;

			// Get provider and send message
			const providerInstance = await getProvider(providerName);
			if (!providerInstance) {
				throw new Error(`Provider ${providerName} não encontrado`);
			}

			await providerInstance.sendMessage(externalId, message);

			// Mark as sent
			await db.update(scheduledReminders).set({ status: 'sent', updatedAt: new Date() }).where(eq(scheduledReminders.id, reminderId));

			schedulerLogger.info({ reminderId }, '✅ Lembrete marcado como enviado');
			return { success: true };
		} catch (error: any) {
			schedulerLogger.error({ reminderId, err: error }, '❌ Erro ao enviar lembrete');
			throw error;
		}
	},
	{ connection: BULLMQ_CONNECTION, concurrency: 5 },
);

// ============================================================================
// EVENT LISTENERS
// ============================================================================

reminderWorker.on('error', (error) => {
	schedulerLogger.error({ err: error }, '❌ [reminder-processing] Erro no worker');
});

reminderWorker.on('ready', () => {
	schedulerLogger.info('✅ [reminder-processing] Worker pronto');
});

reminderWorker.on('active', (job) => {
	schedulerLogger.debug({ jobId: job.id, reminderId: job.data.reminderId }, '🔄 [reminder-processing] Job ativo');
});

reminderWorker.on('completed', (job) => {
	schedulerLogger.info({ jobId: job.id, reminderId: job.data.reminderId }, '✅ [reminder-processing] Lembrete enviado');
});

reminderWorker.on('failed', async (job, error) => {
	schedulerLogger.error({ jobId: job?.id, reminderId: job?.data.reminderId, err: error }, '❌ [reminder-processing] Job falhou');

	// Mark reminder as failed in database
	if (job?.data.reminderId) {
		try {
			await db
				.update(scheduledReminders)
				.set({ status: 'cancelled', updatedAt: new Date() })
				.where(eq(scheduledReminders.id, job.data.reminderId));
		} catch (dbError) {
			schedulerLogger.error({ err: dbError }, '❌ Erro ao atualizar status do lembrete');
		}
	}
});

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Schedule a reminder
 *
 * @param params - Reminder parameters
 * @returns The created reminder ID
 */
export async function scheduleReminder(params: {
	userId: string;
	title: string;
	description?: string;
	scheduledFor: Date;
	provider: ProviderType;
	externalId: string;
}): Promise<string> {
	const { userId, title, description, scheduledFor, provider, externalId } = params;

	// Calculate delay
	const now = new Date();
	const delay = scheduledFor.getTime() - now.getTime();

	if (delay <= 0) {
		throw new Error('A data do lembrete deve ser no futuro');
	}

	// Create database record
	const [reminder] = await db
		.insert(scheduledReminders)
		.values({
			userId,
			title,
			description,
			scheduledFor,
			status: 'pending',
			provider: provider as 'telegram' | 'whatsapp' | 'discord',
			externalId,
		})
		.returning({ id: scheduledReminders.id });

	const reminderId = reminder.id;

	schedulerLogger.info({ reminderId, userId, scheduledFor: scheduledFor.toISOString(), delay }, '📅 Criando lembrete no banco de dados');

	// Schedule job
	const jobId = `reminder:${reminderId}`;

	await reminderQueue.add(
		'send-reminder',
		{
			reminderId,
			userId,
			title,
			description,
			provider,
			externalId,
		},
		{
			jobId,
			delay,
			attempts: 1,
			removeOnComplete: false,
			removeOnFail: false,
		},
	);

	// Update database with job ID
	await db.update(scheduledReminders).set({ bullJobId: jobId }).where(eq(scheduledReminders.id, reminderId));

	schedulerLogger.info({ reminderId, jobId, delayMs: delay }, '✅ Lembrete agendado');

	return reminderId;
}

/**
 * Cancel a scheduled reminder
 *
 * @param reminderId - The reminder ID to cancel
 * @returns True if cancelled, false if not found
 */
export async function cancelReminder(reminderId: string): Promise<boolean> {
	try {
		// Get reminder
		const [reminder] = await db
			.select({ bullJobId: scheduledReminders.bullJobId, status: scheduledReminders.status })
			.from(scheduledReminders)
			.where(eq(scheduledReminders.id, reminderId))
			.limit(1);

		if (!reminder) {
			schedulerLogger.warn({ reminderId }, '⚠️ Lembrete não encontrado');
			return false;
		}

		if (reminder.status !== 'pending') {
			schedulerLogger.info({ reminderId, status: reminder.status }, '⚠️ Lembrete não está pendente');
			return false;
		}

		// Remove from queue
		if (reminder.bullJobId) {
			const job = await reminderQueue.getJob(reminder.bullJobId);
			if (job) {
				await job.remove();
				schedulerLogger.info({ reminderId, jobId: reminder.bullJobId }, '🗑️ Job removido da fila');
			}
		}

		// Update database
		await db
			.update(scheduledReminders)
			.set({
				status: 'cancelled',
				updatedAt: new Date(),
			})
			.where(eq(scheduledReminders.id, reminderId));

		schedulerLogger.info({ reminderId }, '✅ Lembrete cancelado');
		return true;
	} catch (error) {
		schedulerLogger.error({ reminderId, err: error }, '❌ Erro ao cancelar lembrete');
		return false;
	}
}

/**
 * List upcoming reminders for a user
 *
 * @param userId - The user ID
 * @param limit - Maximum number of reminders to return
 * @returns Array of reminders
 */
export async function listUpcomingReminders(
	userId: string,
	limit = 10,
): Promise<
	Array<{
		id: string;
		title: string;
		description: string | null;
		scheduledFor: Date;
		status: 'pending' | 'sent' | 'cancelled';
		provider: ProviderType;
	}>
> {
	const reminders = await db
		.select({
			id: scheduledReminders.id,
			title: scheduledReminders.title,
			description: scheduledReminders.description,
			scheduledFor: scheduledReminders.scheduledFor,
			status: scheduledReminders.status,
			provider: scheduledReminders.provider,
		})
		.from(scheduledReminders)
		.where(eq(scheduledReminders.userId, userId))
		.limit(limit);

	return reminders;
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', async () => {
	schedulerLogger.info('🛑 Recebido SIGTERM, fechando reminder queue...');
	await reminderQueue.close();
});

process.on('SIGINT', async () => {
	schedulerLogger.info('🛑 Recebido SIGINT, fechando reminder queue...');
	await reminderQueue.close();
});
