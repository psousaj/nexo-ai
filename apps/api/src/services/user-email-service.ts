import { db } from '@/db';
import { userEmails, users } from '@/db/schema';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import { and, eq } from 'drizzle-orm';

export class UserEmailService {
	/**
	 * Lista todos os emails de um usuário
	 */
	async getUserEmails(userId: string) {
		return await db.select().from(userEmails).where(eq(userEmails.userId, userId)).orderBy(userEmails.isPrimary);
	}

	/**
	 * Retorna o email primário do usuário
	 */
	async getPrimaryEmail(userId: string): Promise<string | null> {
		const [primary] = await db
			.select()
			.from(userEmails)
			.where(and(eq(userEmails.userId, userId), eq(userEmails.isPrimary, true)))
			.limit(1);

		return primary?.email || null;
	}

	/**
	 * Adiciona um novo email ao usuário
	 */
	async addEmail(userId: string, email: string, provider: string, verified = false) {
		// Verifica se email já existe globalmente
		const [existing] = await db.select().from(userEmails).where(eq(userEmails.email, email)).limit(1);

		if (existing) {
			if (existing.userId === userId) {
				loggers.webhook.info({ userId, email }, 'Email já pertence ao usuário');
				return existing;
			}
			throw new Error('Este email já está em uso por outro usuário');
		}

		// Verifica se usuário já tem email primário
		const [primaryEmail] = await db
			.select()
			.from(userEmails)
			.where(and(eq(userEmails.userId, userId), eq(userEmails.isPrimary, true)))
			.limit(1);

		const [newEmail] = await db
			.insert(userEmails)
			.values({
				userId,
				email,
				isPrimary: !primaryEmail, // Se não tem primário, esse será
				provider,
				verified,
			})
			.returning();

		loggers.webhook.info({ userId, email, isPrimary: newEmail.isPrimary }, '✅ Email adicionado');

		return newEmail;
	}

	/**
	 * Define um email como primário
	 */
	async setPrimaryEmail(userId: string, emailId: string) {
		// Verifica se o email pertence ao usuário
		const [email] = await db
			.select()
			.from(userEmails)
			.where(and(eq(userEmails.id, emailId), eq(userEmails.userId, userId)))
			.limit(1);

		if (!email) {
			throw new Error('Email não encontrado ou não pertence ao usuário');
		}

		// Remove flag isPrimary de todos os emails do usuário
		await db.update(userEmails).set({ isPrimary: false }).where(eq(userEmails.userId, userId));

		// Define o novo email como primário
		await db.update(userEmails).set({ isPrimary: true, updatedAt: new Date() }).where(eq(userEmails.id, emailId));

		// Atualiza o campo email da tabela users (para compatibilidade com Better Auth)
		await db.update(users).set({ email: email.email }).where(eq(users.id, userId));

		loggers.webhook.info({ userId, emailId, email: email.email }, '✅ Email definido como primário');

		return email;
	}

	/**
	 * Remove um email do usuário
	 */
	async removeEmail(userId: string, emailId: string) {
		// Verifica se o email pertence ao usuário
		const [email] = await db
			.select()
			.from(userEmails)
			.where(and(eq(userEmails.id, emailId), eq(userEmails.userId, userId)))
			.limit(1);

		if (!email) {
			throw new Error('Email não encontrado ou não pertence ao usuário');
		}

		// Não permite remover o email primário se for o único
		if (email.isPrimary) {
			const allEmails = await this.getUserEmails(userId);
			if (allEmails.length === 1) {
				throw new Error('Não é possível remover o único email do usuário');
			}

			// Se for primário mas existem outros, define outro como primário primeiro
			const otherEmail = allEmails.find((e) => e.id !== emailId);
			if (otherEmail) {
				await this.setPrimaryEmail(userId, otherEmail.id);
			}
		}

		await db.delete(userEmails).where(eq(userEmails.id, emailId));

		loggers.webhook.info({ userId, emailId, email: email.email }, '✅ Email removido');
	}

	/**
	 * Busca usuário por email (em qualquer dos emails)
	 */
	async findUserByEmail(email: string) {
		const [userEmail] = await db.select().from(userEmails).where(eq(userEmails.email, email)).limit(1);

		if (!userEmail) return null;

		const [user] = await db.select().from(users).where(eq(users.id, userEmail.userId)).limit(1);

		return user;
	}

	/**
	 * Busca email do usuário por ID
	 */
	async getEmailById(userId: string, emailId: string) {
		const [email] = await db
			.select()
			.from(userEmails)
			.where(and(eq(userEmails.id, emailId), eq(userEmails.userId, userId)))
			.limit(1);

		return email || null;
	}

	/**
	 * Marca email como verificado para o usuário
	 */
	async markEmailAsVerified(userId: string, email: string): Promise<boolean> {
		const [updated] = await db
			.update(userEmails)
			.set({ verified: true, updatedAt: new Date() })
			.where(and(eq(userEmails.userId, userId), eq(userEmails.email, email)))
			.returning({ id: userEmails.id });

		if (!updated) {
			return false;
		}

		await db.update(users).set({ emailVerified: true, status: 'active', updatedAt: new Date() }).where(eq(users.id, userId));

		return true;
	}
}

export const userEmailService = instrumentService('userEmail', new UserEmailService());
