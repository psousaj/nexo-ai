import pino from "pino";
import { env } from "@/config/env";

const isDev = env.NODE_ENV === "development";

/**
 * Logger configurado com pino
 * Em desenvolvimento: usa pretty print customizado
 * Em produção: usa formato JSON estruturado
 */
export const logger = pino({
  level: env.LOG_LEVEL || "info",
  transport: isDev
    ? {
        target: "pino/file",
        options: {},
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  ...(isDev && {
    // Pretty print customizado para dev
    transport: undefined, // Remove transport
  }),
});

// Se estiver em dev, usa console.log formatado
if (isDev) {
  const originalLogger = logger;
  const logLevels = {
    info: "ℹ️",
    debug: "🔍",
    warn: "⚠️",
    error: "❌",
  };

  const createPrettyLogger = (level: keyof typeof logLevels) => {
    return (obj: any, msg?: string, ...args: any[]) => {
      const emoji = logLevels[level];
      const context = obj?.context ? `[${obj.context}]` : "";
      const message = msg || obj?.msg || "";
      const time = new Date().toLocaleTimeString("pt-BR");

      console.log(`${time} ${emoji} ${context} ${message}`);
      
      if (obj && typeof obj === "object" && Object.keys(obj).length > 1) {
        const filtered = { ...obj };
        delete filtered.context;
        delete filtered.msg;
        delete filtered.level;
        delete filtered.time;
        
        if (Object.keys(filtered).length > 0) {
          console.log("  →", JSON.stringify(filtered, null, 2).replace(/\n/g, "\n  "));
        }
      }
    };
  };

  (logger as any).info = createPrettyLogger("info");
  (logger as any).debug = createPrettyLogger("debug");
  (logger as any).warn = createPrettyLogger("warn");
  (logger as any).error = createPrettyLogger("error");
}

/**
 * Loggers específicos por contexto
 */
export const loggers = {
  webhook: logger.child({ context: "webhook" }),
  ai: logger.child({ context: "ai" }),
  cloudflare: logger.child({ context: "cloudflare" }),
  gemini: logger.child({ context: "gemini" }),
  claude: logger.child({ context: "claude" }),
  db: logger.child({ context: "db" }),
  enrichment: logger.child({ context: "enrichment" }),
};
