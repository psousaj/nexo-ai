import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { env as zodEnv } from '@/config/env';
import app from '@/app';

app.listen(zodEnv.PORT, () => {
	console.log(`🦊 Nexo AI rodando em http://localhost:${zodEnv.PORT}`);
	console.log(`📚 Documentação: http://localhost:${zodEnv.PORT}/swagger`);
});

export default httpServerHandler({ port: parseInt(zodEnv.PORT) });
