import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { agentTokens, users } from '../../db/schema.js';

export interface AgentToken {
  id: number;
  userId: number;
  name: string;
  tokenPrefix: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTokenWithUser extends AgentToken {
  user: {
    id: number;
    email: string;
    name: string | null;
  };
}

export class AgentTokenRepository {
  async listUserTokens(userId: number): Promise<AgentToken[]> {
    const rows = await db
      .select()
      .from(agentTokens)
      .where(eq(agentTokens.userId, userId))
      .orderBy(desc(agentTokens.createdAt));

    return rows.map(this.mapToAgentToken);
  }

  async createToken(data: {
    userId: number;
    name: string;
    tokenHash: string;
    tokenPrefix: string;
    expiresAt?: Date | null;
  }): Promise<AgentToken> {
    const result = await db
      .insert(agentTokens)
      .values({
        userId: data.userId,
        name: data.name,
        tokenHash: data.tokenHash,
        tokenPrefix: data.tokenPrefix,
        expiresAt: data.expiresAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return this.mapToAgentToken(result[0]);
  }

  async findActiveTokenByHash(tokenHash: string): Promise<AgentTokenWithUser | null> {
    const rows = await db
      .select({
        id: agentTokens.id,
        userId: agentTokens.userId,
        name: agentTokens.name,
        tokenPrefix: agentTokens.tokenPrefix,
        expiresAt: agentTokens.expiresAt,
        revokedAt: agentTokens.revokedAt,
        lastUsedAt: agentTokens.lastUsedAt,
        createdAt: agentTokens.createdAt,
        updatedAt: agentTokens.updatedAt,
        userEmail: users.email,
        userName: users.name
      })
      .from(agentTokens)
      .innerJoin(users, eq(agentTokens.userId, users.id))
      .where(eq(agentTokens.tokenHash, tokenHash))
      .limit(1);

    const row = rows[0];
    if (!row || row.revokedAt) {
      return null;
    }

    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      tokenPrefix: row.tokenPrefix,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.userId,
        email: row.userEmail,
        name: row.userName
      }
    };
  }

  async touchLastUsed(tokenId: number): Promise<void> {
    await db
      .update(agentTokens)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(agentTokens.id, tokenId));
  }

  async revokeToken(tokenId: number, userId: number): Promise<AgentToken | null> {
    const result = await db
      .update(agentTokens)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(agentTokens.id, tokenId), eq(agentTokens.userId, userId)))
      .returning();

    return result[0] ? this.mapToAgentToken(result[0]) : null;
  }

  async deleteToken(tokenId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(agentTokens)
      .where(and(eq(agentTokens.id, tokenId), eq(agentTokens.userId, userId)))
      .returning();

    return result.length > 0;
  }

  private mapToAgentToken(row: typeof agentTokens.$inferSelect): AgentToken {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      tokenPrefix: row.tokenPrefix,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
