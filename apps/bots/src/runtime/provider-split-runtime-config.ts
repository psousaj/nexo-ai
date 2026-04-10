import { parseBotsRuntimeEnv } from "@nexo/env";

export type ProviderSplitRuntimeConfigSource = "env" | "api";

interface PivotFeatureFlagsSnapshot {
  CONVERSATION_FREE: boolean;
  TOOL_SCHEMA_V2: boolean;
  MULTIMODAL_AUDIO: boolean;
  MULTIMODAL_IMAGE: boolean;
  PROVIDER_SPLIT: boolean;
  ELYSIA_RUNTIME: boolean;
}

interface ProviderSplitRuntimeConfigResponse {
  success: true;
  data: {
    version: "1.0";
    providerSplitEnabled: boolean;
    flags: PivotFeatureFlagsSnapshot;
    fetchedAt: string;
  };
}

export interface ProviderSplitRuntimeConfigSnapshot {
  providerSplitEnabled: boolean;
  source: ProviderSplitRuntimeConfigSource;
  endpointUrl: string | null;
  refreshIntervalMs: number;
  requestTimeoutMs: number;
  lastAttemptAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  failureCount: number;
  pollingActive: boolean;
}

export interface CreateProviderSplitRuntimeConfigServiceOptions {
  initialProviderSplitEnabled?: boolean;
  endpointUrl?: string;
  sharedToken?: string;
  refreshIntervalMs?: number;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  logger?: Pick<Console, "info" | "warn">;
  onProviderSplitChanged?: (
    next: boolean,
    previous: boolean,
  ) => Promise<void> | void;
}

interface MutableRuntimeState {
  providerSplitEnabled: boolean;
  source: ProviderSplitRuntimeConfigSource;
  lastAttemptAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  failureCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPivotFlagsSnapshot(
  value: unknown,
): value is PivotFeatureFlagsSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.CONVERSATION_FREE === "boolean" &&
    typeof value.TOOL_SCHEMA_V2 === "boolean" &&
    typeof value.MULTIMODAL_AUDIO === "boolean" &&
    typeof value.MULTIMODAL_IMAGE === "boolean" &&
    typeof value.PROVIDER_SPLIT === "boolean" &&
    typeof value.ELYSIA_RUNTIME === "boolean"
  );
}

function isProviderSplitRuntimeConfigResponse(
  payload: unknown,
): payload is ProviderSplitRuntimeConfigResponse {
  if (!isRecord(payload) || payload.success !== true) {
    return false;
  }

  const data = payload.data;
  if (!isRecord(data)) {
    return false;
  }

  return (
    data.version === "1.0" &&
    typeof data.providerSplitEnabled === "boolean" &&
    typeof data.fetchedAt === "string" &&
    isPivotFlagsSnapshot(data.flags)
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "unknown runtime config error";
}

function normalizeRefreshIntervalMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 30000;
  }

  return Math.max(1000, Math.floor(value));
}

function normalizeRequestTimeoutMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 3000;
  }

  return Math.max(500, Math.floor(value));
}

export function createProviderSplitRuntimeConfigService(
  options: CreateProviderSplitRuntimeConfigServiceOptions = {},
) {
  const parsedBotsEnv = parseBotsRuntimeEnv(process.env);
  const endpointUrl = options.endpointUrl ?? parsedBotsEnv.BOTS_CONFIG_PULL_URL;
  const sharedToken =
    options.sharedToken ?? parsedBotsEnv.BOTS_CONFIG_PULL_TOKEN;
  const refreshIntervalMs = normalizeRefreshIntervalMs(
    options.refreshIntervalMs ?? parsedBotsEnv.BOTS_CONFIG_REFRESH_MS,
  );
  const requestTimeoutMs = normalizeRequestTimeoutMs(
    options.requestTimeoutMs ?? parsedBotsEnv.BOTS_CONFIG_TIMEOUT_MS,
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const logger = options.logger ?? console;
  const onProviderSplitChanged = options.onProviderSplitChanged;

  const state: MutableRuntimeState = {
    providerSplitEnabled:
      options.initialProviderSplitEnabled ?? parsedBotsEnv.PROVIDER_SPLIT,
    source: "env",
    lastAttemptAt: null,
    lastSyncedAt: null,
    lastError: null,
    failureCount: 0,
  };

  let refreshTimer: NodeJS.Timeout | null = null;

  function getSnapshot(): ProviderSplitRuntimeConfigSnapshot {
    return {
      providerSplitEnabled: state.providerSplitEnabled,
      source: state.source,
      endpointUrl: endpointUrl ?? null,
      refreshIntervalMs,
      requestTimeoutMs,
      lastAttemptAt: state.lastAttemptAt,
      lastSyncedAt: state.lastSyncedAt,
      lastError: state.lastError,
      failureCount: state.failureCount,
      pollingActive: refreshTimer !== null,
    };
  }

  async function pullRemoteConfig(): Promise<ProviderSplitRuntimeConfigSnapshot> {
    if (!endpointUrl) {
      return getSnapshot();
    }

    state.lastAttemptAt = now().toISOString();

    try {
      const headers: HeadersInit = {
        Accept: "application/json",
      };

      if (sharedToken) {
        headers.Authorization = `Bearer ${sharedToken}`;
      }

      const response = await fetchImpl(endpointUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`runtime config endpoint returned ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!isProviderSplitRuntimeConfigResponse(payload)) {
        throw new Error("invalid runtime config payload");
      }

      const runtimePayload = payload as ProviderSplitRuntimeConfigResponse;
      const previousProviderSplit = state.providerSplitEnabled;

      state.providerSplitEnabled = runtimePayload.data.providerSplitEnabled;
      state.source = "api";
      state.lastSyncedAt = now().toISOString();
      state.lastError = null;
      state.failureCount = 0;

      if (
        previousProviderSplit !== state.providerSplitEnabled &&
        onProviderSplitChanged
      ) {
        await onProviderSplitChanged(
          state.providerSplitEnabled,
          previousProviderSplit,
        );
      }
    } catch (error) {
      state.failureCount += 1;
      state.lastError = toErrorMessage(error);

      logger.warn("failed to refresh provider split runtime config", {
        endpointUrl,
        error: state.lastError,
        failureCount: state.failureCount,
      });
    }

    return getSnapshot();
  }

  async function initialize(): Promise<ProviderSplitRuntimeConfigSnapshot> {
    if (!endpointUrl) {
      logger.info(
        "provider split runtime config pull disabled (no endpoint configured)",
      );
      return getSnapshot();
    }

    if (!sharedToken) {
      logger.warn(
        "provider split runtime config pull disabled (missing BOTS_CONFIG_PULL_TOKEN)",
      );
      return getSnapshot();
    }

    await pullRemoteConfig();

    if (!refreshTimer) {
      refreshTimer = setInterval(() => {
        void pullRemoteConfig();
      }, refreshIntervalMs);
    }

    return getSnapshot();
  }

  async function shutdown(): Promise<void> {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return {
    initialize,
    refreshNow: pullRemoteConfig,
    getSnapshot,
    shutdown,
  };
}

export const providerSplitRuntimeConfigService =
  createProviderSplitRuntimeConfigService();
