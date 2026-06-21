// ============================================================================
// UPDATE TOOLS
// ============================================================================

/**
 * Tool: update_user_settings
 * Atualiza configurações do usuário (nome do assistente, etc)
 */
export async function update_user_settings(
	context: ToolContext,
	params: {
		assistantName?: string;
	},
): Promise<ToolOutput> {
	try {
		const { preferencesService } = await import('@/services/preferences-service');

		if (params.assistantName !== undefined) {
			await preferencesService.setAssistantName(context.userId, params.assistantName);

			return {
				success: true,
				message: params.assistantName ? `Nome atualizado para "${params.assistantName}"` : 'Nome resetado para "Nexo"',
			};
		}

		return { success: false, error: 'Nenhuma configuração fornecida' };
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao atualizar configurações');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao atualizar',
		};
	}
}

// ============================================================================
// PREFERENCES TOOLS
// ============================================================================

/**
 * Tool: get_assistant_name
 * Retorna o nome customizado do assistente (ou null para default)
 */
export async function get_assistant_name(context: ToolContext, _params: {}): Promise<ToolOutput> {
	try {
		const { preferencesService } = await import('@/services/preferences-service');
		const name = await preferencesService.getAssistantName(context.userId);

		return {
			success: true,
			data: { name: name || 'Nexo' },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao buscar nome do assistente');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar preferências',
		};
	}
}

// ============================================================================
// MEMORY SEARCH TOOLS (OpenClaw Pattern)
// ============================================================================

/**
 * Tool: memory_search
 * Search user memory using hybrid vector + keyword search
 */
export async function memory_search(
	context: ToolContext,
	params: {
		query: string;
		maxResults?: number;
		types?: string[];
	},
): Promise<ToolOutput> {
	try {
		const { searchMemory } = await import('@/services/memory-search');

		const results = await searchMemory({
			query: params.query,
			userId: context.userId,
			maxResults: params.maxResults || 10,
			types: params.types,
		});

		loggers.tools.info({ query: params.query, resultsCount: results.length }, '✅ Memory search tool executed');

		return {
			success: true,
			data: {
				results: results.map((r) => ({
					id: r.id,
					type: r.type,
					title: r.title,
					metadata: r.metadata,
					score: r.score,
				})),
				count: results.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Memory search tool failed');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar memória',
		};
	}
}

/**
 * Tool: memory_get
 * Get specific memory item by ID
 */
export async function memory_get(
	context: ToolContext,
	params: {
		id: string;
	},
): Promise<ToolOutput> {
	try {
		const { getMemoryItem } = await import('@/services/memory-search');

		const item = await getMemoryItem(params.id, context.userId);

		if (!item) {
			return {
				success: false,
				error: 'Item não encontrado',
			};
		}

		return {
			success: true,
			data: {
				id: item.id,
				type: item.type,
				title: item.title,
				metadata: item.metadata,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Memory get tool failed');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar item',
		};
	}
}

/**
 * Tool: daily_log_search
 * Search daily logs for specific date or content
 */
export async function daily_log_search(
	context: ToolContext,
	params: {
		date?: string;
		query?: string;
	},
): Promise<ToolOutput> {
	try {
		const { searchDailyLogs } = await import('@/services/memory-search');

		const logs = await searchDailyLogs({
			userId: context.userId,
			date: params.date,
			query: params.query,
		});

		return {
			success: true,
			data: {
				logs,
				count: logs.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Daily log search tool failed');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar diário',
		};
	}
}

// ============================================================================
// INTEGRATION TOOLS - Calendar, Todo, Reminders
// ============================================================================

/**
 * Tool: list_calendar_events
 */
export async function list_calendar_events(
	context: ToolContext,
	params: {
		startDate?: string;
		endDate?: string;
		maxResults?: number;
	},
): Promise<ToolOutput> {
	try {
		const { hasGoogleCalendarConnected, listCalendarEvents } = await import(
			'@/services/integrations/google-calendar.service'
		);

		const isConnected = await hasGoogleCalendarConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Google primeiro. Use o link no dashboard para conectar.',
			};
		}

		let startDate: Date | undefined;
		let endDate: Date | undefined;

		if (params.startDate) {
			const { parseNaturalDate } = await import('@/services/date-parser');
			startDate = await parseNaturalDate(params.startDate);
		}

		if (params.endDate) {
			const { parseNaturalDate } = await import('@/services/date-parser');
			endDate = await parseNaturalDate(params.endDate);
		}

		const events = await listCalendarEvents(context.userId, startDate, endDate, params.maxResults || 10);

		return {
			success: true,
			data: {
				events: events.map((e) => ({
					id: e.id,
					title: e.title,
					description: e.description,
					start: e.start.toISOString(),
					end: e.end?.toISOString(),
					location: e.location,
				})),
				count: events.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao listar eventos do calendário');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao listar eventos',
		};
	}
}

/**
 * Tool: create_calendar_event
 */
export async function create_calendar_event(
	context: ToolContext,
	params: {
		title: string;
		startDate: string;
		endDate?: string;
		description?: string;
		duration?: number;
		location?: string;
	},
): Promise<ToolOutput> {
	try {
		const { hasGoogleCalendarConnected, createCalendarEvent: createEvent } = await import(
			'@/services/integrations/google-calendar.service'
		);

		const isConnected = await hasGoogleCalendarConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Google primeiro.',
			};
		}

		const { parseNaturalDate } = await import('@/services/date-parser');
		const startDate = await parseNaturalDate(params.startDate);

		let endDate: Date | undefined;
		if (params.endDate) {
			endDate = await parseNaturalDate(params.endDate);
		} else if (params.duration) {
			endDate = new Date(startDate.getTime() + params.duration * 60 * 1000);
		} else {
			endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
		}

		const eventId = await createEvent(context.userId, {
			title: params.title,
			description: params.description,
			startDate,
			endDate,
			location: params.location,
		});

		return {
			success: true,
			message: `Evento "${params.title}" criado com sucesso para ${startDate.toLocaleString('pt-BR')}`,
			data: { eventId },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao criar evento no calendário');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao criar evento',
		};
	}
}

/**
 * Tool: list_todos
 */
export async function list_todos(context: ToolContext, _params: {}): Promise<ToolOutput> {
	try {
		const { hasMicrosoftTodoConnected, listTasks } = await import('@/services/integrations/microsoft-todo.service');

		const isConnected = await hasMicrosoftTodoConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Microsoft primeiro.',
			};
		}

		const tasks = await listTasks(context.userId);

		return {
			success: true,
			data: {
				tasks: tasks.map((t) => ({
					id: t.id,
					title: t.title,
					description: t.description,
					dueDateTime: t.dueDateTime?.toISOString(),
					isCompleted: t.isCompleted,
				})),
				count: tasks.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao listar tarefas');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao listar tarefas',
		};
	}
}

/**
 * Tool: create_todo
 */
export async function create_todo(
	context: ToolContext,
	params: {
		title: string;
		description?: string;
		dueDate?: string;
	},
): Promise<ToolOutput> {
	try {
		const { hasMicrosoftTodoConnected, createTask } = await import('@/services/integrations/microsoft-todo.service');

		const isConnected = await hasMicrosoftTodoConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Microsoft primeiro.',
			};
		}

		let dueDateTime: Date | undefined;
		if (params.dueDate) {
			const { parseNaturalDate } = await import('@/services/date-parser');
			dueDateTime = await parseNaturalDate(params.dueDate);
		}

		const taskId = await createTask(context.userId, {
			title: params.title,
			description: params.description,
			dueDateTime,
		});

		return {
			success: true,
			message: `Tarefa "${params.title}" criada com sucesso`,
			data: { taskId },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao criar tarefa');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao criar tarefa',
		};
	}
}

/**
 * Tool: schedule_reminder
 */
export async function schedule_reminder(
	context: ToolContext,
	params: {
		title: string;
		description?: string;
		when: string;
	},
): Promise<ToolOutput> {
	try {
		if (!context.provider || !context.externalId) {
			return {
				success: false,
				error: 'Não foi possível identificar o canal para enviar o lembrete',
			};
		}

		const { parseNaturalDate } = await import('@/services/date-parser');
		const scheduledFor = await parseNaturalDate(params.when);

		const { scheduleReminder } = await import('@/services/scheduler-service');
		const reminderId = await scheduleReminder({
			userId: context.userId,
			title: params.title,
			description: params.description,
			scheduledFor,
			provider: context.provider,
			externalId: context.externalId,
		});

		return {
			success: true,
			message: `Lembrete agendado para ${scheduledFor.toLocaleString('pt-BR')}`,
			data: { reminderId, scheduledFor: scheduledFor.toISOString() },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao agendar lembrete');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao agendar lembrete',
		};
	}
}
