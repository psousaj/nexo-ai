import { env } from "@/config/env";
import { db } from "@/db";
import { whatsappSettings } from "@/db/schema";
import { instrumentService } from "@/services/service-instrumentation";
import { loggers } from "@/utils/logger";

interface EvolutionInstancePayload {
  instance?: {
    instanceName?: string;
    status?: string;
    owner?: string;
    profileName?: string;
    apikey?: string;
  };
}

interface EvolutionConnectionStateResponse {
  instance?: {
    instanceName?: string;
    state?: string;
  };
}

interface EvolutionConnectResponse {
  pairingCode?: string;
  code?: string;
  count?: number;
}

interface EvolutionSendListSection {
  title: string;
  rows: Array<{
    title: string;
    description?: string;
    rowId: string;
  }>;
}

function normalizeStatus(
  status?: string,
): "connecting" | "connected" | "disconnected" | "error" {
  const normalized = (status || "").toLowerCase();
  if (normalized === "open" || normalized === "connected") return "connected";
  if (normalized === "connecting" || normalized === "created")
    return "connecting";
  if (
    normalized === "close" ||
    normalized === "closed" ||
    normalized === "disconnected"
  )
    return "disconnected";
  return "error";
}

export class EvolutionService {
  private readonly logger = loggers.api;
  private readonly baseUrl = env.EVOLUTION_API_BASE_URL.replace(/\/+$/, "");
  private readonly instanceName = env.EVOLUTION_INSTANCE_NAME;
  private readonly webhookPath = env.EVOLUTION_WEBHOOK_PATH;

  private get apiKey(): string {
    if (!env.EVOLUTION_API_KEY || !env.EVOLUTION_API_KEY.trim()) {
      throw new Error("EVOLUTION_API_KEY não configurada");
    }
    return env.EVOLUTION_API_KEY;
  }

  private async upsertSettings(payload: {
    instanceName?: string;
    phoneNumber?: string;
    connectionStatus?: "connecting" | "connected" | "disconnected" | "error";
    lastError?: string | null;
  }): Promise<void> {
    await db
      .insert(whatsappSettings)
      .values({
        id: "global",
        activeApi: "evolution",
        phoneNumber: payload.phoneNumber,
        connectionStatus: payload.connectionStatus,
        lastError: payload.lastError || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: whatsappSettings.id,
        set: {
          activeApi: "evolution",
          phoneNumber: payload.phoneNumber,
          connectionStatus: payload.connectionStatus,
          lastError: payload.lastError || null,
          updatedAt: new Date(),
        },
      });
  }

  private buildWebhookUrl(): string {
    const appUrl = env.APP_URL || `http://localhost:${env.PORT}`;
    return `${appUrl.replace(/\/+$/, "")}${this.webhookPath.startsWith("/") ? "" : "/"}${this.webhookPath}`;
  }

  private requestUrl(
    path: string,
    query?: Record<string, string | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value && value.trim()) {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      query?: Record<string, string | undefined>;
      body?: unknown;
      acceptNotFound?: boolean;
    },
  ): Promise<T | null> {
    const response = await fetch(this.requestUrl(path, options?.query), {
      method,
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 404 && options?.acceptNotFound) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Evolution API ${method} ${path} failed: ${response.status} ${errorText}`,
      );
    }

    if (response.status === 204) {
      return null;
    }

    return (await response.json()) as T;
  }

  private normalizeRecipient(recipient: string): string {
    const raw = recipient.includes("@") ? recipient.split("@")[0] : recipient;
    return raw.replace(/\D/g, "");
  }

  private inferMimeType(url: string): string {
    const lower = url.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
  }

  async getInformation(): Promise<Record<string, unknown> | null> {
    return await this.request<Record<string, unknown>>("GET", "/", {
      acceptNotFound: true,
    });
  }

  async fetchInstances(
    instanceName?: string,
  ): Promise<EvolutionInstancePayload[]> {
    const response = await this.request<any>(
      "GET",
      "/instance/fetchInstances",
      {
        query: {
          instanceName,
        },
      },
    );

    if (Array.isArray(response)) {
      return response as EvolutionInstancePayload[];
    }

    if (response?.response && Array.isArray(response.response)) {
      return response.response as EvolutionInstancePayload[];
    }

    return [];
  }

  async getInstance(): Promise<EvolutionInstancePayload | null> {
    const instances = await this.fetchInstances(this.instanceName);
    return (
      instances.find(
        (item) => item.instance?.instanceName === this.instanceName,
      ) || null
    );
  }

  async ensureInstanceUpsert(): Promise<EvolutionInstancePayload | null> {
    const existing = await this.getInstance();
    if (existing) {
      await this.syncSettingsFromInstance(existing);
      return existing;
    }

    const body = {
      instanceName: this.instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        url: this.buildWebhookUrl(),
        byEvents: true,
        base64: true,
        headers: env.EVOLUTION_WEBHOOK_SECRET
          ? {
              authorization: `Bearer ${env.EVOLUTION_WEBHOOK_SECRET}`,
              "Content-Type": "application/json",
            }
          : {
              "Content-Type": "application/json",
            },
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      },
    };

    const created = await this.request<EvolutionInstancePayload>(
      "POST",
      "/instance/create",
      { body },
    );
    if (created) {
      await this.syncSettingsFromInstance(created);
    }

    return created;
  }

  async getConnectionState(): Promise<EvolutionConnectionStateResponse | null> {
    const response = await this.request<EvolutionConnectionStateResponse>(
      "GET",
      `/instance/connectionState/${this.instanceName}`,
      {
        acceptNotFound: true,
      },
    );

    if (response) {
      await this.upsertSettings({
        connectionStatus: normalizeStatus(response.instance?.state),
        lastError: null,
      });
    }

    return response;
  }

  async connectInstance(
    number?: string,
  ): Promise<EvolutionConnectResponse | null> {
    await this.upsertSettings({
      connectionStatus: "connecting",
      lastError: null,
    });

    return await this.request<EvolutionConnectResponse>(
      "GET",
      `/instance/connect/${this.instanceName}`,
      {
        query: { number },
        acceptNotFound: true,
      },
    );
  }

  async restartInstance(): Promise<Record<string, unknown> | null> {
    await this.upsertSettings({
      connectionStatus: "connecting",
      lastError: null,
    });
    return await this.request<Record<string, unknown>>(
      "PUT",
      `/instance/restart/${this.instanceName}`,
      {
        acceptNotFound: true,
      },
    );
  }

  async logoutInstance(): Promise<Record<string, unknown> | null> {
    await this.upsertSettings({
      connectionStatus: "disconnected",
      lastError: null,
    });
    return await this.request<Record<string, unknown>>(
      "DELETE",
      `/instance/logout/${this.instanceName}`,
      {
        acceptNotFound: true,
      },
    );
  }

  async sendText(recipient: string, text: string): Promise<void> {
    await this.request("POST", `/message/sendText/${this.instanceName}`, {
      body: {
        number: this.normalizeRecipient(recipient),
        text,
      },
    });
  }

  async sendMediaImage(
    recipient: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<void> {
    const fileName = mediaUrl.split("/").pop() || "image.jpg";
    await this.request("POST", `/message/sendMedia/${this.instanceName}`, {
      body: {
        number: this.normalizeRecipient(recipient),
        mediatype: "image",
        mimetype: this.inferMimeType(mediaUrl),
        caption: caption || " ",
        media: mediaUrl,
        fileName,
      },
    });
  }

  async sendList(
    recipient: string,
    params: {
      title: string;
      description: string;
      buttonText: string;
      footerText: string;
      values: EvolutionSendListSection[];
    },
  ): Promise<void> {
    await this.request("POST", `/message/sendList/${this.instanceName}`, {
      body: {
        number: this.normalizeRecipient(recipient),
        title: params.title,
        description: params.description,
        buttonText: params.buttonText,
        footerText: params.footerText,
        values: params.values,
      },
    });
  }

  async syncSettingsFromInstance(
    instancePayload: EvolutionInstancePayload,
  ): Promise<void> {
    const instance = instancePayload.instance;
    await this.upsertSettings({
      instanceName: instance?.instanceName,
      phoneNumber: instance?.owner ? instance.owner.split("@")[0] : undefined,
      connectionStatus: normalizeStatus(instance?.status),
      lastError: null,
    });
  }

  async bootstrapIfEnabled(): Promise<void> {
    if (!env.EVOLUTION_BOOTSTRAP_ENABLED) {
      this.logger.info("⚪ Bootstrap Evolution desabilitado via env");
      return;
    }

    const timeoutMs = env.EVOLUTION_BOOTSTRAP_TIMEOUT_MS;
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(new Error(`Timeout no bootstrap Evolution (${timeoutMs}ms)`)),
        timeoutMs,
      );
    });

    await Promise.race([this.ensureInstanceUpsert(), timeout]);
  }
}

export const evolutionService = instrumentService(
  "evolution",
  new EvolutionService(),
);
