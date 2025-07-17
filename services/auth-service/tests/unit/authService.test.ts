import { AuthService } from '../../src/services/authService';
import { TokenService } from '../../src/services/tokenService';
import { UserRepository } from '../../src/models/userRepository';
import { SessionService } from '../../src/services/sessionService';

// Mock dependencies
jest.mock('../../src/services/tokenService');
jest.mock('../../src/models/userRepository');
jest.mock('../../src/services/sessionService');

describe('AuthService', () => {
  let authService: AuthService;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockSessionService: jest.Mocked<SessionService>;

  beforeEach(() => {
    mockTokenService = new TokenService() as jest.Mocked<TokenService>;
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockSessionService = new SessionService() as jest.Mocked<SessionService>;

    authService = new AuthService(mockTokenService, mockUserRepository, mockSessionService);
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      };

      const mockUser = {
        id: 'user-id',
        email: userData.email,
        username: userData.username,
        passwordHash: 'hashed-password',
        createdAt: new Date(),
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        tokenType: 'Bearer' as const,
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockTokenService.generateTokens.mockResolvedValue(mockTokens);
      mockSessionService.createSession.mockResolvedValue();

      const result = await authService.registerUser(userData);

      expect(result.user.email).toBe(userData.email);
      expect(result.user.username).toBe(userData.username);
      expect(result.tokens).toBe(mockTokens);
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockSessionService.createSession).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      };

      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: userData.email,
        username: 'existing',
        passwordHash: 'hash',
        createdAt: new Date(),
      });

      await expect(authService.registerUser(userData)).rejects.toThrow(
        'User already exists with this email'
      );
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 'user-id',
        email: credentials.email,
        username: 'testuser',
        passwordHash: '$2b$12$hashedpassword', // This would be a real bcrypt hash
        createdAt: new Date(),
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        tokenType: 'Bearer' as const,
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockTokenService.generateTokens.mockResolvedValue(mockTokens);
      mockSessionService.createSession.mockResolvedValue();

      // Mock bcrypt.compare to return true
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await authService.authenticateUser(credentials);

      expect(result).toBe(mockTokens);
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(mockUser.id);
      expect(mockSessionService.createSession).toHaveBeenCalled();
    });

    it('should throw error for invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.authenticateUser(credentials)).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      const token = 'valid-token';
      mockTokenService.validateAccessToken.mockResolvedValue({
        userId: 'user-id',
        type: 'access',
      });

      const result = await authService.validateToken(token);

      expect(result).toBe(true);
      expect(mockTokenService.validateAccessToken).toHaveBeenCalledWith(token);
    });

    it('should return false for invalid token', async () => {
      const token = 'invalid-token';
      mockTokenService.validateAccessToken.mockResolvedValue(null);

      const result = await authService.validateToken(token);

      expect(result).toBe(false);
    });
  });
});
