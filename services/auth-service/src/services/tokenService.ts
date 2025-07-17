import jwt from 'jsonwebtoken';
import { AuthToken } from '../../../../shared/src/types';

export interface TokenPayload {
  userId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export class TokenService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  }

  async generateTokens(userId: string): Promise<AuthToken> {
    const accessTokenPayload: TokenPayload = {
      userId,
      type: 'access',
    };

    const refreshTokenPayload: TokenPayload = {
      userId,
      type: 'refresh',
    };

    const accessToken = jwt.sign(accessTokenPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
    });

    // Calculate expiration date (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    return {
      accessToken,
      refreshToken,
      expiresAt,
      tokenType: 'Bearer',
    };
  }

  async validateAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret) as TokenPayload;
      if (payload.type !== 'access') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async validateRefreshToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret) as TokenPayload;
      if (payload.type !== 'refresh') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async decodeToken(token: string): Promise<TokenPayload | null> {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}
