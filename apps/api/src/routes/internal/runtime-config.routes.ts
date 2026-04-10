import { env } from "@nexo/api-core/config/env";
import {
  type PivotFeatureFlags,
  getPivotFeatureFlags,
} from "@nexo/api-core/config/pivot-feature-flags";
import { type ProviderSplitRuntimeConfigResponse } from "@nexo/api-core/config/provider-split-runtime-config";
import { Hono } from "hono";

interface CreateInternalRuntimeConfigRoutesOptions {
  resolveSharedToken?: () => string | undefined;
  resolvePivotFeatureFlags?: () => Promise<PivotFeatureFlags>;
  now?: () => Date;
}

function normalizeAuthorizationToken(
  headerValue: string | undefined,
): string | null {
  if (!headerValue) {
    return null;
  }

  const trimmedValue = headerValue.trim();
  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.toLowerCase().startsWith("bearer ")) {
    const token = trimmedValue.slice(7).trim();
    return token || null;
  }

  return trimmedValue;
}

export function createInternalRuntimeConfigRoutes(
  options: CreateInternalRuntimeConfigRoutesOptions = {},
) {
  const resolveSharedToken =
    options.resolveSharedToken ?? (() => env.BOTS_CONFIG_PULL_TOKEN);
  const resolvePivotFlags =
    options.resolvePivotFeatureFlags ?? getPivotFeatureFlags;
  const now = options.now ?? (() => new Date());

  return new Hono().get("/provider-split-config", async (c) => {
    const expectedToken = resolveSharedToken();
    if (!expectedToken) {
      return c.json(
        {
          success: false,
          error: "provider split runtime endpoint is disabled",
        },
        503,
      );
    }

    const incomingToken = normalizeAuthorizationToken(
      c.req.header("authorization"),
    );
    if (!incomingToken || incomingToken !== expectedToken) {
      return c.json(
        {
          success: false,
          error: "Unauthorized",
        },
        401,
      );
    }

    const flags = await resolvePivotFlags();
    const response: ProviderSplitRuntimeConfigResponse = {
      success: true,
      data: {
        version: "1.0",
        providerSplitEnabled: flags.PROVIDER_SPLIT,
        flags,
        fetchedAt: now().toISOString(),
      },
    };

    c.header("Cache-Control", "no-store");
    return c.json(response);
  });
}

export const internalRuntimeConfigRoutes = createInternalRuntimeConfigRoutes();
