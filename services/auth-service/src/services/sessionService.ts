import { createClient, RedisClientType } from 'redis';

export interface UserSession {
  userId: string;
  refreshToken: string;
  createdAt: Date;
  lastAccessed: Date;
}

export class SessionService {
  private redis: RedisClientType;
  private readonly sessionTTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    this.redis.connect().catch(console.error);
  }

  private getSessionKey(userId: string, refreshToken: string): string {
    return `session:${userId}:${refreshToken}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  async createSession(userId: string, refreshToken: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, refreshToken);
    const userSessionsKey = this.getUserSessionsKey(userId);

    const session: UserSession = {
      userId,
      refreshToken,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    // Store session data
    await this.redis.setEx(sessionKey, this.sessionTTL, JSON.stringify(session));

    // Add to user's session list
    await this.redis.sAdd(userSessionsKey, refreshToken);
    await this.redis.expire(userSessionsKey, this.sessionTTL);
  }

  async getSession(userId: string, refreshToken: string): Promise<UserSession | null> {
    const sessionKey = this.getSessionKey(userId, refreshToken);

    try {
      const sessionData = await this.redis.get(sessionKey);
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData) as UserSession;

      // Update last accessed time
      session.lastAccessed = new Date();
      await this.redis.setEx(sessionKey, this.sessionTTL, JSON.stringify(session));

      return session;
    } catch {
      return null;
    }
  }

  async updateSession(
    userId: string,
    oldRefreshToken: string,
    newRefreshToken: string
  ): Promise<void> {
    // Get existing session
    const session = await this.getSession(userId, oldRefreshToken);
    if (!session) {
      throw new Error('Session not found');
    }

    // Delete old session
    await this.deleteSession(userId, oldRefreshToken);

    // Create new session
    await this.createSession(userId, newRefreshToken);
  }

  async deleteSession(userId: string, refreshToken: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, refreshToken);
    const userSessionsKey = this.getUserSessionsKey(userId);

    // Remove session data
    await this.redis.del(sessionKey);

    // Remove from user's session list
    await this.redis.sRem(userSessionsKey, refreshToken);
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = this.getUserSessionsKey(userId);

    // Get all refresh tokens for user
    const refreshTokens = await this.redis.sMembers(userSessionsKey);

    // Delete all sessions
    const deletePromises = refreshTokens.map(token =>
      this.redis.del(this.getSessionKey(userId, token))
    );

    await Promise.all(deletePromises);

    // Clear user sessions list
    await this.redis.del(userSessionsKey);
  }

  async getUserActiveSessions(userId: string): Promise<string[]> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    return this.redis.sMembers(userSessionsKey);
  }
}
