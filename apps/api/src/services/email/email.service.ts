import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '@/config/env';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import Handlebars from 'handlebars';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type TemplateName = 'confirm-email' | 'change-email' | 'delete-account';

interface EmailVerificationParams {
	user: { id: string; email: string; name?: string | null };
	url: string;
}

interface ChangeEmailParams {
	user: { id: string; email: string; name?: string | null };
	newEmail: string;
	url: string;
}

interface DeleteAccountParams {
	user: { id: string; email: string; name?: string | null };
	url: string;
}

class EmailService {
	private resend: Resend | null = null;
	private readonly appName = 'Nexo Assistente de Memória';
	private templates = new Map<TemplateName, Handlebars.TemplateDelegate>();

	constructor() {
		if (env.RESEND_API_KEY) {
			this.resend = new Resend(env.RESEND_API_KEY);
			this.loadTemplates();
		} else {
			loggers.app.warn('⚠️ Resend API Key não configurada. Envio de email desativado.');
		}
	}

	private loadTemplates() {
		const templateFiles: TemplateName[] = ['confirm-email', 'change-email', 'delete-account'];

		for (const name of templateFiles) {
			const candidates = [
				join(__dirname, `../../templates/emails/${name}.hbs`),
				join(__dirname, `templates/emails/${name}.hbs`),
				join(process.cwd(), `src/templates/emails/${name}.hbs`),
				join(process.cwd(), `dist/templates/emails/${name}.hbs`),
				join(process.cwd(), `apps/api/dist/templates/emails/${name}.hbs`),
			];

			const templatePath = candidates.find((path) => existsSync(path));
			if (!templatePath) {
				throw new Error(`Template ${name}.hbs não encontrado em nenhum caminho conhecido.`);
			}

			const source = readFileSync(templatePath, 'utf-8');
			this.templates.set(name, Handlebars.compile(source));
		}
	}

	private renderTemplate(templateName: TemplateName, data: Record<string, any>) {
		const template = this.templates.get(templateName);
		if (!template) {
			throw new Error(`Template não encontrado: ${templateName}`);
		}

		return template(data);
	}

	async sendEmail(to: string, subject: string, templateName: TemplateName, data: Record<string, any>) {
		if (!this.resend) {
			loggers.app.info({ to, subject }, '📭 Email skipped (Resend não configurado)');
			return;
		}

		const html = this.renderTemplate(templateName, data);

		await this.resend.emails.send({
			from: 'Nexo AI <nexo.onboarding@pinheirodev.com.br>',
			to,
			subject,
			html,
		});
	}

	async sendEmailVerification({ user, url }: EmailVerificationParams) {
		await this.sendEmail(user.email, 'Confirme seu email — Nexo Assistente pessoal de memória', 'confirm-email', {
			appName: this.appName,
			userName: user.name || user.email,
			email: user.email,
			confirmUrl: url,
		});
	}

	async sendChangeEmailConfirmation({ user, newEmail, url }: ChangeEmailParams) {
		await this.sendEmail(user.email, 'Confirme seu novo e-mail — Nexo', 'change-email', {
			appName: this.appName,
			userName: user.name || user.email,
			newEmail,
			confirmUrl: url,
		});
	}

	async sendDeleteAccountVerification({ user, url }: DeleteAccountParams) {
		await this.sendEmail(user.email, 'Confirmação de exclusão de conta — Nexo', 'delete-account', {
			appName: this.appName,
			userName: user.name || user.email,
			email: user.email,
			confirmUrl: url,
		});
	}
}

export const emailService = instrumentService('email', new EmailService());
