import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserCredentials, AuthToken, User } from '../../../../shared/src/types';
import { TokenService } from './tokenService';
import { UserRepository } from '../models/userRepository';
import { SessionService } from './sessionService';

export interface RegisterUserData extends UserCredentials {
  username: string;
}

export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private tokenService: TokenService,
    private userRepository: UserRepository,
    private sessionService: SessionService
  ) {}

  async registerUser(
    userData: RegisterUserData
  ): Promise<{ user: Omit<User, 'preferences' | 'subscription'>; tokens: AuthToken }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Check if username is taken
    const existingUsername = await this.userRepository.findByUsername(userData.username);
    if (existingUsername) {
      throw new Error('Username is already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, this.saltRounds);

    // Create user
    const userId = uuidv4();
    const user = await this.userRepository.create({
      id: userId,
      email: userData.email,
      username: userData.username,
      passwordHash: hashedPassword,
      createdAt: new Date(),
    });

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(userId);

    // Create session
    await this.sessionService.createSession(userId, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  async authenticateUser(credentials: UserCredentials): Promise<AuthToken> {
    // Find user by email
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user.id);

    // Create or update session
    await this.sessionService.createSession(user.id, tokens.refreshToken);

    return tokens;
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    // Validate refresh token
    const payload = await this.tokenService.validateRefreshToken(refreshToken);
    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    // Check if session exists
    const session = await this.sessionService.getSession(payload.userId, refreshToken);
    if (!session) {
      throw new Error('Session not found');
    }

    // Generate new tokens
    const tokens = await this.tokenService.generateTokens(payload.userId);

    // Update session with new refresh token
    await this.sessionService.updateSession(payload.userId, refreshToken, tokens.refreshToken);

    return tokens;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const payload = await this.tokenService.validateAccessToken(token);
      return !!payload;
    } catch {
      return false;
    }
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const payload = await this.tokenService.validateRefreshToken(refreshToken);
    if (payload) {
      await this.sessionService.deleteSession(payload.userId, refreshToken);
    }
  }

  async encryptSensitiveData(data: string): Promise<string> {
    const { encryptData, generateEncryptionKey } = await import(
      '../../../../shared/src/utils/encryption'
    );
    const encryptionKey = process.env.DATA_ENCRYPTION_KEY || generateEncryptionKey();

    if (!process.env.DATA_ENCRYPTION_KEY) {
      console.warn(
        '⚠️  DATA_ENCRYPTION_KEY not set. Using generated key (not recommended for production)'
      );
    }

    const result = encryptData(data, encryptionKey);
    return JSON.stringify(result);
  }

  async decryptSensitiveData(encryptedData: string): Promise<string> {
    const { decryptData } = await import('../../../../shared/src/utils/encryption');
    const encryptionKey = process.env.DATA_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error('DATA_ENCRYPTION_KEY not configured');
    }

    try {
      const input = JSON.parse(encryptedData);
      return decryptData(input, encryptionKey);
    } catch (error) {
      throw new Error(
        `Data decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
