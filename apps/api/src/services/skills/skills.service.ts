/**
 * Skills Service (NEX-30)
 *
 * Gerencia skills do agente: built-in + user-defined.
 * Skills são fluxos reutilizáveis que o agente carrega sob demanda
 * quando o contexto da conversa combina com triggers.
 */
import { db } from '@/db';
import { agentSkills } from '@/db/schema';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import { eq, or, sql } from 'drizzle-orm';
import { BUILT_IN_SKILLS, type SkillDefinition } from './built-in-skills';

interface AgentSkill {
	id: string;
	userId: string | null;
	name: string;
	description: string | null;
	content: string;
	triggers: string[] | null;
	enabled: boolean;
	isBuiltIn: boolean;
	version: number;
}

class SkillsService {
	/**
	 * Salva uma skill (user-defined) no banco
	 */
	async saveSkill(userId: string, name: string, content: string, description?: string, triggers?: string[]): Promise<AgentSkill> {
		const existing = await db
			.select()
			.from(agentSkills)
			.where(or(eq(agentSkills.name, name), eq(agentSkills.userId, userId)))
			.limit(1);

		if (existing.length > 0 && existing[0].userId === userId) {
			// Update existing
			const [updated] = await db
				.update(agentSkills)
				.set({
					content,
					description: description ?? existing[0].description,
					triggers: triggers ?? existing[0].triggers,
					version: existing[0].version + 1,
					updatedAt: new Date(),
				})
				.where(eq(agentSkills.id, existing[0].id))
				.returning();
			return updated;
		}

		const [created] = await db
			.insert(agentSkills)
			.values({
				userId,
				name,
				description: description ?? null,
				content,
				triggers: triggers ?? [],
			})
			.returning();
		return created;
	}

	/**
	 * Carrega uma skill por nome (busca primeiro user, depois built-in)
	 */
	async loadSkill(name: string, userId?: string): Promise<SkillDefinition | null> {
		// Buscar user-defined primeiro
		if (userId) {
			const [userSkill] = await db
				.select()
				.from(agentSkills)
				.where(or(eq(agentSkills.name, name), eq(agentSkills.userId, userId)))
				.limit(1);
			if (userSkill) {
				return {
					name: userSkill.name,
					description: userSkill.description ?? '',
					content: userSkill.content,
					triggers: userSkill.triggers ?? [],
				};
			}
		}

		// Fallback para built-in
		return BUILT_IN_SKILLS.find((s) => s.name === name) ?? null;
	}

	/**
	 * Busca skills cujos triggers batem com o texto da mensagem
	 */
	async getRelevantSkills(messageText: string, userId?: string): Promise<SkillDefinition[]> {
		const relevant: SkillDefinition[] = [];
		const lowerText = messageText.toLowerCase();

		// Built-in skills
		for (const skill of BUILT_IN_SKILLS) {
			for (const trigger of skill.triggers) {
				if (lowerText.includes(trigger.toLowerCase())) {
					relevant.push(skill);
					break;
				}
			}
		}

		// User-defined skills from DB
		if (userId) {
			const userSkills = await db.select().from(agentSkills).where(eq(agentSkills.userId, userId));
			for (const skill of userSkills) {
				if (!skill.triggers) continue;
				for (const trigger of skill.triggers) {
					if (lowerText.includes(trigger.toLowerCase())) {
						relevant.push({
							name: skill.name,
							description: skill.description ?? '',
							content: skill.content,
							triggers: skill.triggers,
						});
						break;
					}
				}
			}
		}

		return relevant;
	}

	/**
	 * Formata skills para inclusão no system prompt
	 */
	formatSkillsForPrompt(skills: SkillDefinition[]): string {
		if (skills.length === 0) return '';

		const sections = skills.map(
			(skill) =>
				`## Skill: ${skill.name}\n**Descrição:** ${skill.description}\n\n${skill.content}`,
		);

		return `\n\n## Skills Carregadas\n${sections.join('\n\n---\n\n')}`;
	}
}

export const skillsService = instrumentService('skills', new SkillsService());

