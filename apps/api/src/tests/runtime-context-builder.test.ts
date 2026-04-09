import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetHistory,
  mockGetUserById,
  mockBuildAgentContext,
  mockBuildAgentPrompt,
} = vi.hoisted(() => ({
  mockGetHistory: vi.fn(),
  mockGetUserById: vi.fn(),
  mockBuildAgentContext: vi.fn(),
  mockBuildAgentPrompt: vi.fn(),
}));

vi.mock("@nexo/api-core/services/conversation-service", () => ({
  conversationService: {
    getHistory: mockGetHistory,
  },
}));

vi.mock("@nexo/api-core/services/user-service", () => ({
  userService: {
    getUserById: mockGetUserById,
  },
}));

vi.mock("@nexo/api-core/services/context-builder", () => ({
  buildAgentContext: mockBuildAgentContext,
}));

vi.mock("@nexo/api-core/config/prompt-builder", () => ({
  buildAgentPrompt: mockBuildAgentPrompt,
}));

describe("buildRuntimeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockResolvedValue([
      { role: "assistant", content: "Oi! Como posso ajudar?" },
      { role: "user", content: "Salva um link pra mim" },
    ]);
    mockBuildAgentPrompt.mockImplementation(
      ({ assistantName }: { assistantName: string }) => ({
        system: `SYSTEM:${assistantName}`,
      }),
    );
  });

  it("usa fallback por user quando não há sessionKey", async () => {
    mockGetUserById.mockResolvedValue({
      id: "user-1",
      assistantName: "Aurora",
    });

    const { buildRuntimeContext } =
      await import("@nexo/api-core/services/ai/runtime-context-builder");
    const result = await buildRuntimeContext({
      conversationId: "conv-1",
      userId: "user-1",
      message: "Me lembra de revisar amanhã",
      availableTools: ["save_note", "search_items"],
    });

    expect(mockGetUserById).toHaveBeenCalledWith("user-1");
    expect(mockBuildAgentContext).not.toHaveBeenCalled();
    expect(result.assistantName).toBe("Aurora");
    expect(result.systemPrompt).toBe("SYSTEM:Aurora");
    expect(result.historyBlocks).toHaveLength(3);
    expect(result.historyBlocks[2]).toEqual({
      role: "user",
      content: "Me lembra de revisar amanhã",
      source: "current",
    });
    expect(result.openAIMessages).toEqual([
      { role: "assistant", content: "Oi! Como posso ajudar?" },
      { role: "user", content: "Salva um link pra mim" },
      { role: "user", content: "Me lembra de revisar amanhã" },
    ]);
  });

  it("usa contexto personalizado quando há sessionKey", async () => {
    mockBuildAgentContext.mockResolvedValue({
      assistantName: "Nexo Prime",
      systemPrompt: "Preferências: respostas curtas e objetivas.",
    });

    const { buildRuntimeContext } =
      await import("@nexo/api-core/services/ai/runtime-context-builder");
    const result = await buildRuntimeContext({
      conversationId: "conv-1",
      userId: "user-1",
      message: "Busca meus links",
      availableTools: ["search_items"],
      sessionKey: "agent:main:telegram:direct:user-1",
    });

    expect(mockBuildAgentContext).toHaveBeenCalledTimes(1);
    expect(mockBuildAgentContext).toHaveBeenCalledWith(
      "user-1",
      "agent:main:telegram:direct:user-1",
    );
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockBuildAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantName: "Nexo Prime",
        availableTools: ["search_items"],
      }),
    );
    expect(result.systemPrompt).toContain("SYSTEM:Nexo Prime");
    expect(result.systemPrompt).toContain("# PERSONALIZED CONTEXT");
    expect(result.systemPrompt).toContain(
      "Preferências: respostas curtas e objetivas.",
    );
  });
});
