import axios from 'axios';
import { EveEsiService, EsiRateLimitError } from '../../src/services/eveEsiService';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  })),
  get: jest.fn(),
  isAxiosError: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EveEsiService', () => {
  let eveEsiService: EveEsiService;

  beforeEach(() => {
    eveEsiService = new EveEsiService();
    jest.clearAllMocks();
  });

  describe('validateApiKey', () => {
    it('should successfully validate a valid API key', async () => {
      const mockTokenInfo = {
        CharacterID: 123456789,
        CharacterName: 'Test Character',
        ExpiresOn: '2024-12-31T23:59:59Z',
        Scopes: 'esi-markets.read_character_orders.v1 esi-wallet.read_character_wallet.v1',
        TokenType: 'Bearer',
        CharacterOwnerHash: 'test-hash',
        IntellectualProperty: 'EVE',
      };

      const mockCharacterInfo = {
        character_id: 123456789,
        name: 'Test Character',
        corporation_id: 987654321,
        alliance_id: 111222333,
        birthday: '2020-01-01',
        gender: 'male',
        race_id: 1,
        bloodline_id: 1,
        ancestry_id: 1,
      };

      // Mock the axios.get calls
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockTokenInfo }) // Token verification
        .mockResolvedValueOnce({ data: mockCharacterInfo }); // Character info

      const result = await eveEsiService.validateApiKey('test-access-token');

      expect(result).toEqual({
        characterId: 123456789,
        characterName: 'Test Character',
        scopes: ['esi-markets.read_character_orders.v1', 'esi-wallet.read_character_wallet.v1'],
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        isValid: true,
      });
    });

    it('should throw error for invalid access token', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { error: 'invalid_token' },
        },
      };

      mockedAxios.get.mockRejectedValue(mockError);

      await expect(eveEsiService.validateApiKey('invalid-token')).rejects.toThrow(
        'API key validation failed: Invalid or expired access token'
      );
    });

    it('should throw error for forbidden access', async () => {
      const mockError = {
        response: {
          status: 403,
          data: { error: 'forbidden' },
        },
      };

      mockedAxios.get.mockRejectedValue(mockError);

      await expect(eveEsiService.validateApiKey('forbidden-token')).rejects.toThrow(
        'API key validation failed: Access token lacks required permissions'
      );
    });
  });

  describe('getCharacterInfo', () => {
    it('should successfully get character information', async () => {
      const mockCharacterInfo = {
        character_id: 123456789,
        name: 'Test Character',
        corporation_id: 987654321,
        alliance_id: 111222333,
        birthday: '2020-01-01',
        gender: 'male',
        race_id: 1,
        bloodline_id: 1,
        ancestry_id: 1,
      };

      // Mock the axios instance
      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockCharacterInfo }),
      };

      // Replace the client instance
      (eveEsiService as any).client = mockAxiosInstance;

      const result = await eveEsiService.getCharacterInfo(123456789, 'test-token');

      expect(result).toEqual(mockCharacterInfo);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://esi.evetech.net/latest/characters/123456789/',
        { headers: { Authorization: 'Bearer test-token' } }
      );
    });

    it('should handle character not found', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { error: 'character_not_found' },
        },
      };

      const mockAxiosInstance = {
        get: jest.fn().mockRejectedValue(mockError),
      };

      (eveEsiService as any).client = mockAxiosInstance;

      await expect(eveEsiService.getCharacterInfo(999999999)).rejects.toThrow(
        'Character not found'
      );
    });
  });

  describe('hasRequiredScopes', () => {
    it('should return true when all required scopes are present', () => {
      const scopes = [
        'esi-markets.read_character_orders.v1',
        'esi-wallet.read_character_wallet.v1',
        'esi-assets.read_assets.v1',
        'esi-characters.read_contacts.v1',
      ];

      const result = eveEsiService.hasRequiredScopes(scopes);

      expect(result).toBe(true);
    });

    it('should return false when required scopes are missing', () => {
      const scopes = ['esi-markets.read_character_orders.v1', 'esi-characters.read_contacts.v1'];

      const result = eveEsiService.hasRequiredScopes(scopes);

      expect(result).toBe(false);
    });

    it('should return false for empty scopes array', () => {
      const result = eveEsiService.hasRequiredScopes([]);

      expect(result).toBe(false);
    });
  });

  describe('getRecommendedScopes', () => {
    it('should return array of recommended scopes', () => {
      const scopes = eveEsiService.getRecommendedScopes();

      expect(scopes).toContain('esi-markets.read_character_orders.v1');
      expect(scopes).toContain('esi-wallet.read_character_wallet.v1');
      expect(scopes).toContain('esi-assets.read_assets.v1');
      expect(Array.isArray(scopes)).toBe(true);
      expect(scopes.length).toBeGreaterThan(0);
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate correct OAuth authorization URL', () => {
      const clientId = 'test-client-id';
      const redirectUri = 'https://example.com/callback';
      const state = 'test-state';

      const authUrl = eveEsiService.generateAuthUrl(clientId, redirectUri, state);

      expect(authUrl).toContain('https://login.eveonline.com/v2/oauth/authorize/');
      expect(authUrl).toContain(`client_id=${clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=');
    });
  });

  describe('rate limiting', () => {
    it('should throw EsiRateLimitError when rate limited', async () => {
      const mockError = {
        response: {
          status: 429,
          headers: {
            'retry-after': '60',
          },
          data: { error: 'rate_limited' },
        },
      };

      const mockAxiosInstance = {
        get: jest.fn().mockRejectedValue(mockError),
      };

      (eveEsiService as any).client = mockAxiosInstance;

      await expect(eveEsiService.getCharacterInfo(123456789)).rejects.toThrow(EsiRateLimitError);

      try {
        await eveEsiService.getCharacterInfo(123456789);
      } catch (error) {
        expect(error).toBeInstanceOf(EsiRateLimitError);
        expect((error as EsiRateLimitError).retryAfter).toBe(60);
      }
    });
  });
});
