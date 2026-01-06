import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export class UserService {
  /**
   * Busca ou cria usuário por número de telefone
   */
  async findOrCreateUser(phoneNumber: string, whatsappName?: string) {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phoneNumber))
      .limit(1);

    if (existingUser) {
      // Atualiza nome se fornecido e diferente
      if (whatsappName && whatsappName !== existingUser.name) {
        await db
          .update(users)
          .set({ name: whatsappName })
          .where(eq(users.id, existingUser.id));
        return { ...existingUser, name: whatsappName };
      }
      return existingUser;
    }

    const [newUser] = await db
      .insert(users)
      .values({ phone: phoneNumber, name: whatsappName })
      .returning();

    return newUser;
  }

  async getUserById(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }
}

export const userService = new UserService();
