/**
 * Microsoft To Do Integration Service
 *
 * Handles Microsoft To Do API operations using OAuth tokens from Better Auth.
 * Uses Microsoft Graph API v1.0
 */

import { db } from '@/db';
import { accounts, microsoftTodoIntegrations } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { and, eq } from 'drizzle-orm';

const logger = loggers.integrations;

/**
 * Microsoft To Do Task Interface
 */
export interface MicrosoftTodoTask {
	id?: string;
	title: string;
	description?: string;
	dueDateTime?: Date;
	isCompleted?: boolean;
}

/**
 * Microsoft Graph API Task List
 */
interface TaskList {
	id: string;
	displayName: string;
	wellknownListName?: string;
}

/**
 * Microsoft Graph API Task
 */
interface GraphTask {
	id: string;
	title: string;
	body?: {
		content: string;
		contentType: string;
	};
	dueDateTime?: {
		dateTime: string;
		timeZone: string;
	};
	status: string;
}

/**
 * Get access token for a user with auto-refresh
 */
async function getAccessToken(userId: string): Promise<string> {
	// Find Microsoft account
	const [account] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.providerId, 'microsoft'), eq(accounts.userId, userId)))
		.limit(1);

	if (!account) {
		throw new Error('Conta Microsoft não conectada');
	}

	if (!account.accessToken || !account.refreshToken) {
		throw new Error('Tokens OAuth não encontrados');
	}

	// Check if access token is expired
	const now = new Date();
	const isExpired = account.accessTokenExpiresAt && account.accessTokenExpiresAt <= now;

	if (isExpired) {
		logger.info({ userId }, '🔄 Token Microsoft expirado, renovando...');

		try {
			// Refresh token using Microsoft's token endpoint
			const response = await fetch('https://login.microsoftonline.com/common/oauth/v2.0/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					client_id: process.env.MICROSOFT_CLIENT_ID || '',
					client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
					refresh_token: account.refreshToken,
					grant_type: 'refresh_token',
				}),
			});

			if (!response.ok) {
				throw new Error(`Failed to refresh token: ${response.statusText}`);
			}

			const data = (await response.json()) as {
				access_token: string;
				refresh_token?: string;
				expires_in?: number;
			};

			// Calculate expiry
			const expiresIn = data.expires_in || 3600;
			const expiresAt = new Date(now.getTime() + expiresIn * 1000);

			// Update database
			await db
				.update(accounts)
				.set({
					accessToken: data.access_token,
					refreshToken: data.refresh_token || account.refreshToken,
					accessTokenExpiresAt: expiresAt,
					updatedAt: new Date(),
				})
				.where(eq(accounts.id, account.id));

			logger.info({ userId }, '✅ Token Microsoft renovado com sucesso');

			return data.access_token;
		} catch (error) {
			logger.error({ userId, err: error }, '❌ Erro ao renovar token Microsoft');
			throw new Error('Falha ao renovar token de acesso Microsoft');
		}
	}

	return account.accessToken;
}

/**
 * Get or create Microsoft To Do integration record
 */
async function getOrCreateIntegration(userId: string): Promise<string> {
	const [integration] = await db
		.select()
		.from(microsoftTodoIntegrations)
		.where(eq(microsoftTodoIntegrations.userId, userId))
		.limit(1);

	if (integration?.defaultTaskListId) {
		return integration.defaultTaskListId;
	}

	// Create default integration and get default task list
	const accessToken = await getAccessToken(userId);

	// Get the default task list (wellknownListName: 'defaultList')
	const response = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to get task lists: ${response.statusText}`);
	}

	const data = (await response.json()) as { value: TaskList[] };

	// Find default list or use first list
	const defaultList = data.value.find((list) => list.wellknownListName === 'defaultList') || data.value[0];

	if (!defaultList) {
		throw new Error('No task list found');
	}

	// Save to database
	const [newIntegration] = await db
		.insert(microsoftTodoIntegrations)
		.values({
			userId,
			defaultTaskListId: defaultList.id,
		})
		.returning();

	logger.info({ userId, taskListId: defaultList.id }, '✅ Integração Microsoft To Do criada');

	return newIntegration.defaultTaskListId || defaultList.id;
}

/**
 * List all tasks
 */
export async function listTasks(userId: string): Promise<
	Array<{
		id: string;
		title: string;
		description?: string;
		dueDateTime?: Date;
		isCompleted: boolean;
	}>
> {
	logger.info({ userId }, '📋 Listando tarefas do Microsoft To Do');

	try {
		const accessToken = await getAccessToken(userId);
		const taskListId = await getOrCreateIntegration(userId);

		const response = await fetch(
			`https://graph.microsoft.com/v1.0/me/todo/lists/${taskListId}/tasks?$filter=status ne 'completed'`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to list tasks: ${response.statusText}`);
		}

		const data = (await response.json()) as { value: GraphTask[] };

		const tasks = data.value.map((task) => ({
			id: task.id,
			title: task.title,
			description: task.body?.content,
			dueDateTime: task.dueDateTime ? new Date(task.dueDateTime.dateTime) : undefined,
			isCompleted: task.status === 'completed',
		}));

		logger.info({ userId, count: tasks.length }, '✅ Tarefas listadas com sucesso');

		return tasks;
	} catch (error) {
		logger.error({ userId, err: error }, '❌ Erro ao listar tarefas');
		throw error;
	}
}

/**
 * Create a new task
 */
export async function createTask(userId: string, task: MicrosoftTodoTask): Promise<string> {
	logger.info({ userId, title: task.title }, '📋 Criando tarefa no Microsoft To Do');

	try {
		const accessToken = await getAccessToken(userId);
		const taskListId = await getOrCreateIntegration(userId);

		const requestBody: any = {
			title: task.title,
		};

		if (task.description) {
			requestBody.body = {
				content: task.description,
				contentType: 'text',
			};
		}

		if (task.dueDateTime) {
			requestBody.dueDateTime = {
				dateTime: task.dueDateTime.toISOString(),
				timeZone: 'UTC',
			};
		}

		const response = await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${taskListId}/tasks`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to create task: ${response.statusText} - ${errorText}`);
		}

		const data = (await response.json()) as { id: string };
		const taskId = data.id;

		// Update integration sync timestamp
		await db
			.update(microsoftTodoIntegrations)
			.set({
				syncedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(microsoftTodoIntegrations.userId, userId));

		logger.info({ userId, taskId, title: task.title }, '✅ Tarefa criada com sucesso');

		return taskId;
	} catch (error) {
		logger.error({ userId, err: error }, '❌ Erro ao criar tarefa');
		throw error;
	}
}

/**
 * Check if user has connected Microsoft To Do
 */
export async function hasMicrosoftTodoConnected(userId: string): Promise<boolean> {
	try {
		const [account] = await db
			.select()
			.from(accounts)
			.where(and(eq(accounts.providerId, 'microsoft'), eq(accounts.userId, userId)));

		if (!account) return false;

		// Check if Tasks scope is present
		return account.scope?.includes('Tasks') || false;
	} catch {
		return false;
	}
}

/**
 * Get all tasks (simplified for AI tools)
 */
export async function getAllTasks(userId: string): Promise<
	Array<{
		id: string;
		title: string;
		description?: string;
		dueDateTime?: Date;
		isCompleted: boolean;
	}>
> {
	return listTasks(userId);
}
