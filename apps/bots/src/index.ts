import { serve } from "@hono/node-server";
import { createBotsApp } from "./app";

const app = createBotsApp();
const port = Number(process.env.BOTS_PORT || process.env.PORT || 3030);

serve({
  fetch: app.fetch,
  port,
});

console.log(`bots app listening on port ${port}`);
