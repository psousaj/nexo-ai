import { Resend } from 'resend';
import { env } from '@/config/env';
import { db } from '@/db';
import { errorReports } from '@/db/schema';
import { gte, desc } from 'drizzle-orm';
import { loggers } from '@/utils/logger';

export class ErrorReportService {
	private resend: Resend | null = null;
	private appName = 'Nexo AI';

	constructor() {
		if (env.RESEND_API_KEY) {
			this.resend = new Resend(env.RESEND_API_KEY);
		} else {
			loggers.app.warn('⚠️ Resend API Key não configurada. Relatórios por email desativados.');
		}
	}

	async sendDailyReport() {
		if (!this.resend || !env.ADMIN_EMAIL) {
			loggers.app.info('📭 Email reporting skipped (config missing)');
			return;
		}

		try {
			// Busca erros das últimas 24h
			const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const errors = await db
				.select()
				.from(errorReports)
				.where(gte(errorReports.createdAt, yesterday))
				.orderBy(desc(errorReports.createdAt));

			if (errors.length === 0) {
				loggers.app.info('✅ Nenhum erro nas últimas 24h. Relatório pulado.');
				return;
			}

			// Agrupa por tipo
			const byType = errors.reduce(
				(acc, curr) => {
					acc[curr.errorType] = (acc[curr.errorType] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			);

			// Gera HTML simples
			const html = `
                <h1>📊 Relatório de Erros - ${this.appName}</h1>
                <p><strong>Total (24h):</strong> ${errors.length}</p>
                
                <h2>Resumo por Tipo</h2>
                <ul>
                    ${Object.entries(byType)
											.map(([type, count]) => `<li><strong>${type}:</strong> ${count}</li>`)
											.join('')}
                </ul>

                <h2>Erros Recentes</h2>
                <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background: #f0f0f0;">
                            <th>Hora</th>
                            <th>Tipo</th>
                            <th>Mensagem</th>
                            <th>Session ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${errors
													.slice(0, 20) // Top 20
													.map(
														(err) => `
                            <tr>
                                <td>${err.createdAt?.toLocaleTimeString('pt-BR')}</td>
                                <td>${err.errorType}</td>
                                <td>${err.errorMessage.substring(0, 100)}...</td>
                                <td><code>${err.sessionId || 'N/A'}</code></td>
                            </tr>
                        `,
													)
													.join('')}
                    </tbody>
                </table>
                <p><em>Exibindo os 20 erros mais recentes.</em></p>
            `;

			await this.resend.emails.send({
				from: 'Nexo Reports <onboarding@resend.dev>', // Use verified domain or onboarding
				to: env.ADMIN_EMAIL,
				subject: `[${this.appName}] 🚨 ${errors.length} erros detectados nas últimas 24h`,
				html,
			});

			loggers.app.info({ count: errors.length }, '📧 Relatório de erros enviado com sucesso');
		} catch (error) {
			loggers.app.error({ err: error }, '❌ Falha ao enviar relatório de erros');
		}
	}
}

export const errorReportService = new ErrorReportService();
