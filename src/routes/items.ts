import { Elysia, t } from "elysia";
import { itemService } from "@/services/item-service";

const itemModel = t.Object({
  id: t.String({ format: "uuid" }),
  userId: t.String({ format: "uuid" }),
  type: t.Union([
    t.Literal("movie"),
    t.Literal("video"),
    t.Literal("link"),
    t.Literal("note"),
  ]),
  title: t.String(),
  metadata: t.Any(),
  createdAt: t.Date(),
});

export const itemsRouter = new Elysia({ prefix: "/items" })
  /**
   * GET /items - Lista items do usuário
   */
  .get(
    "/",
    async ({ query }) => {
      const items = await itemService.listItems({
        userId: query.userId,
        type: query.type,
        limit: query.limit,
      });

      return { items };
    },
    {
      query: t.Object({
        userId: t.String({ format: "uuid" }),
        type: t.Optional(
          t.Union([
            t.Literal("movie"),
            t.Literal("video"),
            t.Literal("link"),
            t.Literal("note"),
          ])
        ),
        limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
      }),
      response: {
        200: t.Object({
          items: t.Array(itemModel),
        }),
      },
      detail: {
        tags: ["Items"],
        summary: "Lista items do usuário",
        description:
          "Retorna uma lista de items filtrados por usuário e opcionalmente por tipo",
      },
    }
  )

  /**
   * GET /items/:id - Busca item por ID
   */
  .get(
    "/:id",
    async ({ params, query }) => {
      const item = await itemService.getItemById(params.id, query.userId);

      if (!item) {
        return { error: "Item não encontrado" };
      }

      return { item };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        userId: t.String({ format: "uuid" }),
      }),
      response: {
        200: t.Object({
          item: itemModel,
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        tags: ["Items"],
        summary: "Busca item por ID",
        description: "Retorna um item específico pelo seu ID",
      },
    }
  )

  /**
   * POST /items/search - Busca semântica
   */
  .post(
    "/search",
    async ({ body }) => {
      const items = await itemService.searchItems({
        userId: body.userId,
        query: body.query,
        limit: body.limit,
      });

      return { items };
    },
    {
      body: t.Object({
        userId: t.String({ format: "uuid" }),
        query: t.String({ minLength: 1, maxLength: 500 }),
        limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
      }),
      response: {
        200: t.Object({
          items: t.Array(itemModel),
        }),
      },
      detail: {
        tags: ["Items"],
        summary: "Busca semântica de items",
        description: "Busca items usando busca semântica no título e metadata",
      },
    }
  )

  /**
   * DELETE /items/:id - Deleta item
   */
  .delete(
    "/:id",
    async ({ params, query }) => {
      console.log("DELETE request:", { params, query });
      await itemService.deleteItem(params.id, query.userId);
      const response = { success: true };
      console.log("DELETE response:", response);
      return response;
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        userId: t.String({ format: "uuid" }),
      }),
      response: {
        200: t.Object(
          {
            success: t.Boolean(),
          },
          { additionalProperties: false }
        ),
      },
      detail: {
        tags: ["Items"],
        summary: "Deleta um item",
        description: "Remove um item do banco de dados",
      },
    }
  );
