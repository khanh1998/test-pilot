import { createHash, randomBytes } from 'node:crypto';
import {
  AgentTokenRepository,
  type AgentToken,
  type AgentTokenWithUser
} from '../../repository/db/agent-token.js';

export interface CreatedAgentToken {
  token: AgentToken;
  plainTextToken: string;
}

export interface AgentTokenAuthContext {
  tokenId: number;
  userId: number;
  email: string;
  name?: string;
}

export class AgentTokenService {
  private agentTokenRepo: AgentTokenRepository;

  constructor() {
    this.agentTokenRepo = new AgentTokenRepository();
  }

  async listUserTokens(userId: number): Promise<AgentToken[]> {
    return this.agentTokenRepo.listUserTokens(userId);
  }

  async createToken(
    userId: number,
    data: { name: string; expiresAt?: Date | null }
  ): Promise<CreatedAgentToken> {
    const name = data.name.trim();
    if (!name) {
      throw new Error('Token name is required');
    }

    if (name.length > 255) {
      throw new Error('Token name cannot exceed 255 characters');
    }

    if (data.expiresAt && data.expiresAt.getTime() <= Date.now()) {
      throw new Error('Expiration date must be in the future');
    }

    const plainTextToken = this.generatePlainTextToken();
    const token = await this.agentTokenRepo.createToken({
      userId,
      name,
      tokenHash: this.hashToken(plainTextToken),
      tokenPrefix: this.getTokenPrefix(plainTextToken),
      expiresAt: data.expiresAt ?? null
    });

    return {
      token,
      plainTextToken
    };
  }

  async revokeToken(tokenId: number, userId: number): Promise<AgentToken> {
    const token = await this.agentTokenRepo.revokeToken(tokenId, userId);
    if (!token) {
      throw new Error('Token not found');
    }

    return token;
  }

  async deleteToken(tokenId: number, userId: number): Promise<void> {
    const deleted = await this.agentTokenRepo.deleteToken(tokenId, userId);
    if (!deleted) {
      throw new Error('Token not found');
    }
  }

  async authenticateToken(token: string): Promise<AgentTokenAuthContext> {
    const cleanedToken = token.trim();
    if (!cleanedToken) {
      throw new Error('Invalid agent token');
    }

    const agentToken = await this.agentTokenRepo.findActiveTokenByHash(
      this.hashToken(cleanedToken)
    );
    if (!agentToken) {
      throw new Error('Invalid or expired agent token');
    }

    await this.agentTokenRepo.touchLastUsed(agentToken.id);

    return this.mapToAuthContext(agentToken);
  }

  private generatePlainTextToken(): string {
    return `tpa_${randomBytes(32).toString('base64url')}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getTokenPrefix(token: string): string {
    return `${token.slice(0, 12)}...`;
  }

  private mapToAuthContext(token: AgentTokenWithUser): AgentTokenAuthContext {
    return {
      tokenId: token.id,
      userId: token.user.id,
      email: token.user.email,
      name: token.user.name ?? undefined
    };
  }
}
