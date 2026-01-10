import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { env } from "@/config/env";
import { healthRouter } from "@/routes/health";
import { webhookRouter } from "@/routes/webhook";
import { itemsRouter } from "@/routes/items";

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "Nexo AI API",
          version: "0.1.0",
          description: "Assistente pessoal via WhatsApp com IA",
        },
      },
    })
  )
  .onError(({ code, error, set }) => {
    console.error(`[${code}]`, error);

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Rota não encontrada" };
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Dados inválidos" };
    }

    set.status = 500;
    return { error: "Erro interno do servidor" };
  })
  .use(healthRouter)
  .use(webhookRouter)
  .use(itemsRouter)
  .listen(parseInt(env.PORT));

console.log(`🦊 Nexo AI rodando em http://localhost:${env.PORT}`);
console.log(`📚 Documentação: http://localhost:${env.PORT}/swagger`);

export default app;
