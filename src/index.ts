// New Relic deve ser importado PRIMEIRO (antes de qualquer outro módulo)
import 'newrelic';
import app from '@/app';
import { env } from '@/config/env';

const PORT = parseInt(env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
	console.log(`🚀 Nexo AI rodando em http://0.0.0.0:${PORT}`);
	console.log(`📚 Environment: ${env.NODE_ENV}`);
});
