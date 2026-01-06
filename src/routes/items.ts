import { Elysia, t } from "elysia";
import { itemService } from "@/services/item-service";
import type { ItemType } from "@/types";

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
        userId: t.String(),
        type: t.Optional(t.String()),
        limit: t.Optional(t.Number()),
      }),
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
        id: t.String(),
      }),
      query: t.Object({
        userId: t.String(),
      }),
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
        userId: t.String(),
        query: t.String(),
        limit: t.Optional(t.Number()),
      }),
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
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        userId: t.String(),
      }),
    }
  );
