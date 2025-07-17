import { TokenService } from '../../src/services/tokenService';

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    tokenService = new TokenService();
  });

  describe('generateTokens', () => {
    it('should generate valid access and refresh tokens', async () => {
      const userId = 'test-user-id';
      const tokens = await tokenService.generateTokens(userId);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresAt');
      expect(tokens).toHaveProperty('tokenType', 'Bearer');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate different tokens for different users', async () => {
      const tokens1 = await tokenService.generateTokens('user1');
      const tokens2 = await tokenService.generateTokens('user2');

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('validateAccessToken', () => {
    it('should validate a valid access token', async () => {
      const userId = 'test-user-id';
      const tokens = await tokenService.generateTokens(userId);

      const payload = await tokenService.validateAccessToken(tokens.accessToken);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(userId);
      expect(payload?.type).toBe('access');
    });

    it('should reject an invalid token', async () => {
      const payload = await tokenService.validateAccessToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should reject a refresh token as access token', async () => {
      const userId = 'test-user-id';
      const tokens = await tokenService.generateTokens(userId);

      const payload = await tokenService.validateAccessToken(tokens.refreshToken);
      expect(payload).toBeNull();
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid refresh token', async () => {
      const userId = 'test-user-id';
      const tokens = await tokenService.generateTokens(userId);

      const payload = await tokenService.validateRefreshToken(tokens.refreshToken);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(userId);
      expect(payload?.type).toBe('refresh');
    });

    it('should reject an access token as refresh token', async () => {
      const userId = 'test-user-id';
      const tokens = await tokenService.generateTokens(userId);

      const payload = await tokenService.validateRefreshToken(tokens.accessToken);
      expect(payload).toBeNull();
    });
  });
});
