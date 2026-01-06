import { Elysia } from "elysia";
import { itemService } from "@/services/item-service";
import {
  listItemsQuerySchema,
  listItemsResponseSchema,
  getItemParamsSchema,
  getItemQuerySchema,
  getItemResponseSchema,
  searchItemsBodySchema,
  searchItemsResponseSchema,
  deleteItemParamsSchema,
  deleteItemQuerySchema,
  deleteItemResponseSchema,
  errorResponseSchema,
} from "@/schemas";

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
      query: listItemsQuerySchema,
      response: {
        200: listItemsResponseSchema,
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
      params: getItemParamsSchema,
      query: getItemQuerySchema,
      response: {
        200: getItemResponseSchema,
        404: errorResponseSchema,
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
      body: searchItemsBodySchema,
      response: {
        200: searchItemsResponseSchema,
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
      await itemService.deleteItem(params.id, query.userId);
      return { success: true };
    },
    {
      params: deleteItemParamsSchema,
      query: deleteItemQuerySchema,
      response: {
        200: deleteItemResponseSchema,
      },
      detail: {
        tags: ["Items"],
        summary: "Deleta um item",
        description: "Remove um item do banco de dados",
      },
    }
  );
