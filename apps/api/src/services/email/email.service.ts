import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '@/config/env';
import { accountLinkingService } from '@/services/account-linking-service';
import { loggers } from '@/utils/logger';
import Handlebars from 'handlebars';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type TemplateName = 'confirm-email';

interface ConfirmationEmailParams {
	userId: string;
	userName: string;
	email: string;
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
		const candidates = [
			// Local dev (tsx): src/services/email/ -> src/templates/...
			join(__dirname, '../../templates/emails/confirm-email.hbs'),
			// Build bundle (tsup): dist/index.js -> dist/templates/...
			join(__dirname, 'templates/emails/confirm-email.hbs'),
			// Local executando em apps/api
			join(process.cwd(), 'src/templates/emails/confirm-email.hbs'),
			join(process.cwd(), 'dist/templates/emails/confirm-email.hbs'),
			// Docker executando na raiz /app
			join(process.cwd(), 'apps/api/dist/templates/emails/confirm-email.hbs'),
		];

		const templatePath = candidates.find((path) => existsSync(path));
		if (!templatePath) {
			throw new Error('Template confirm-email.hbs não encontrado em nenhum caminho conhecido.');
		}

		const source = readFileSync(templatePath, 'utf-8');
		this.templates.set('confirm-email', Handlebars.compile(source));
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
			from: 'Nexo AI <onboarding@resend.dev>',
			to,
			subject,
			html,
		});
	}

	async sendConfirmationEmail({ userId, userName, email }: ConfirmationEmailParams) {
		const token = await accountLinkingService.generateLinkingToken(userId, undefined, 'email_confirm', email);
		const dashboardUrl = env.DASHBOARD_URL || 'http://localhost:5173';
		const confirmUrl = `${dashboardUrl}/confirm-email?token=${encodeURIComponent(token)}`;

		await this.sendEmail(email, 'Confirme seu email — Nexo AI', 'confirm-email', {
			appName: this.appName,
			userName,
			email,
			confirmUrl,
		});
	}
}

export const emailService = new EmailService();
