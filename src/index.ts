import app from '@/app';
import { env } from '@/config/env';

app.listen(env.PORT, () => {
	console.log(`🚀 Nexo AI rodando em http://0.0.0.0:${env.PORT}`);
	console.log(`📚 Environment: ${env.NODE_ENV}`);
	console.log(`⚡ Runtime: Bun`);
});
