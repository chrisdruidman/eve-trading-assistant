import { EveApiKeyService } from '../../src/services/eveApiKeyService';
import { EveCharacterRepository } from '../../src/models/eveCharacterRepository';
import { EveEsiService } from '../../src/services/eveEsiService';
import { EveApiKeyInfo } from '../../../../shared/src/types';

// Mock the dependencies
jest.mock('../../src/models/eveCharacterRepository');
jest.mock('../../src/services/eveEsiService');
jest.mock('../../../../shared/src/utils/encryption', () => ({
  encryptApiKey: jest.fn().mockReturnValue('encrypted-api-key'),
  decryptApiKey: jest.fn().mockReturnValue('decrypted-api-key'),
  generateEncryptionKey: jest.fn().mockReturnValue('test-encryption-key'),
}));

describe('EveApiKeyService', () => {
  let eveApiKeyService: EveApiKeyService;
  let mockEveCharacterRepository: jest.Mocked<EveCharacterRepository>;
  let mockEveEsiService: jest.Mocked<EveEsiService>;

  beforeEach(() => {
    mockEveCharacterRepository =
      new EveCharacterRepository() as jest.Mocked<EveCharacterRepository>;
    mockEveEsiService = new EveEsiService() as jest.Mocked<EveEsiService>;
    eveApiKeyService = new EveApiKeyService(mockEveCharacterRepository, mockEveEsiService);

    // Set up environment variable mock
    process.env.EVE_API_ENCRYPTION_KEY = 'test-encryption-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.EVE_API_ENCRYPTION_KEY;
  });

  describe('addApiKey', () => {
    it('should successfully add a new API key', async () => {
      const mockApiKeyInfo: EveApiKeyInfo = {
        characterId: 123456789,
        characterName: 'Test Character',
        scopes: ['esi-markets.read_character_orders.v1'],
        expiresAt: new Date('2024-12-31'),
        isValid: true,
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

      const mockCharacterRecord = {
        id: 'char-uuid',
        userId: 'user-uuid',
        characterId: 123456789,
        characterName: 'Test Character',
        corporationId: 987654321,
        allianceId: 111222333,
        encryptedApiKey: 'encrypted-api-key',
        scopes: ['esi-markets.read_character_orders.v1'],
        lastSync: new Date(),
        expiresAt: new Date('2024-12-31'),
        isValid: true,
        createdAt: new Date(),
      };

      mockEveEsiService.validateApiKey.mockResolvedValue(mockApiKeyInfo);
      mockEveEsiService.getCharacterInfo.mockResolvedValue(mockCharacterInfo);
      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(null);
      mockEveCharacterRepository.create.mockResolvedValue(mockCharacterRecord);

      const result = await eveApiKeyService.addApiKey({
        userId: 'user-uuid',
        accessToken: 'test-access-token',
      });

      expect(result).toEqual({
        characterId: 123456789,
        characterName: 'Test Character',
        corporationId: 987654321,
        allianceId: 111222333,
        apiKey: 'encrypted-api-key',
        scopes: ['esi-markets.read_character_orders.v1'],
        lastSync: expect.any(Date),
      });

      expect(mockEveEsiService.validateApiKey).toHaveBeenCalledWith('test-access-token');
      expect(mockEveEsiService.getCharacterInfo).toHaveBeenCalledWith(
        123456789,
        'test-access-token'
      );
      expect(mockEveCharacterRepository.create).toHaveBeenCalled();
    });

    it('should update existing character when API key already exists', async () => {
      const mockApiKeyInfo: EveApiKeyInfo = {
        characterId: 123456789,
        characterName: 'Test Character',
        scopes: ['esi-markets.read_character_orders.v1'],
        expiresAt: new Date('2024-12-31'),
        isValid: true,
      };

      const existingCharacterRecord = {
        id: 'char-uuid',
        userId: 'user-uuid',
        characterId: 123456789,
        characterName: 'Test Character',
        corporationId: 987654321,
        allianceId: 111222333,
        encryptedApiKey: 'old-encrypted-key',
        scopes: ['old-scope'],
        lastSync: new Date(),
        expiresAt: new Date('2024-06-30'),
        isValid: false,
        createdAt: new Date(),
      };

      const updatedCharacterRecord = {
        ...existingCharacterRecord,
        encryptedApiKey: 'encrypted-api-key',
        scopes: ['esi-markets.read_character_orders.v1'],
        expiresAt: new Date('2024-12-31'),
        isValid: true,
      };

      mockEveEsiService.validateApiKey.mockResolvedValue(mockApiKeyInfo);
      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(
        existingCharacterRecord
      );
      mockEveCharacterRepository.updateApiKey.mockResolvedValue(updatedCharacterRecord);

      const result = await eveApiKeyService.addApiKey({
        userId: 'user-uuid',
        accessToken: 'test-access-token',
      });

      expect(result.scopes).toEqual(['esi-markets.read_character_orders.v1']);
      expect(mockEveCharacterRepository.updateApiKey).toHaveBeenCalledWith(
        'user-uuid',
        123456789,
        'encrypted-api-key',
        new Date('2024-12-31'),
        ['esi-markets.read_character_orders.v1']
      );
    });

    it('should throw error when API key validation fails', async () => {
      mockEveEsiService.validateApiKey.mockRejectedValue(new Error('Invalid API key'));

      await expect(
        eveApiKeyService.addApiKey({
          userId: 'user-uuid',
          accessToken: 'invalid-token',
        })
      ).rejects.toThrow('Failed to add API key: Invalid API key');
    });
  });

  describe('validateApiKey', () => {
    it('should return valid result for valid API key', async () => {
      const mockCharacterRecord = {
        id: 'char-uuid',
        userId: 'user-uuid',
        characterId: 123456789,
        characterName: 'Test Character',
        corporationId: 987654321,
        allianceId: 111222333,
        encryptedApiKey: 'encrypted-api-key',
        scopes: ['esi-markets.read_character_orders.v1'],
        lastSync: new Date(),
        expiresAt: new Date('2024-12-31'),
        isValid: true,
        createdAt: new Date(),
      };

      const mockApiKeyInfo: EveApiKeyInfo = {
        characterId: 123456789,
        characterName: 'Test Character',
        scopes: ['esi-markets.read_character_orders.v1'],
        expiresAt: new Date('2024-12-31'),
        isValid: true,
      };

      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(mockCharacterRecord);
      mockEveEsiService.validateApiKey.mockResolvedValue(mockApiKeyInfo);
      mockEveCharacterRepository.updateLastSync.mockResolvedValue();

      const result = await eveApiKeyService.validateApiKey('user-uuid', 123456789);

      expect(result.isValid).toBe(true);
      expect(result.character).toBeDefined();
      expect(mockEveCharacterRepository.updateLastSync).toHaveBeenCalledWith(
        'user-uuid',
        123456789
      );
    });

    it('should return invalid result when character not found', async () => {
      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(null);

      const result = await eveApiKeyService.validateApiKey('user-uuid', 123456789);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Character not found');
    });

    it('should mark API key as invalid when validation fails', async () => {
      const mockCharacterRecord = {
        id: 'char-uuid',
        userId: 'user-uuid',
        characterId: 123456789,
        characterName: 'Test Character',
        corporationId: 987654321,
        allianceId: 111222333,
        encryptedApiKey: 'encrypted-api-key',
        scopes: ['esi-markets.read_character_orders.v1'],
        lastSync: new Date(),
        expiresAt: new Date('2024-12-31'),
        isValid: true,
        createdAt: new Date(),
      };

      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(mockCharacterRecord);
      mockEveEsiService.validateApiKey.mockRejectedValue(new Error('Token expired'));
      mockEveCharacterRepository.markAsInvalid.mockResolvedValue();

      const result = await eveApiKeyService.validateApiKey('user-uuid', 123456789);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(mockEveCharacterRepository.markAsInvalid).toHaveBeenCalledWith('user-uuid', 123456789);
    });
  });

  describe('getUserCharacters', () => {
    it('should return all characters for a user', async () => {
      const mockCharacterRecords = [
        {
          id: 'char-uuid-1',
          userId: 'user-uuid',
          characterId: 123456789,
          characterName: 'Test Character 1',
          corporationId: 987654321,
          allianceId: 111222333,
          encryptedApiKey: 'encrypted-api-key-1',
          scopes: ['esi-markets.read_character_orders.v1'],
          lastSync: new Date(),
          expiresAt: new Date('2024-12-31'),
          isValid: true,
          createdAt: new Date(),
        },
        {
          id: 'char-uuid-2',
          userId: 'user-uuid',
          characterId: 987654321,
          characterName: 'Test Character 2',
          corporationId: 123456789,
          allianceId: undefined,
          encryptedApiKey: 'encrypted-api-key-2',
          scopes: ['esi-wallet.read_character_wallet.v1'],
          lastSync: new Date(),
          expiresAt: new Date('2024-12-31'),
          isValid: true,
          createdAt: new Date(),
        },
      ];

      mockEveCharacterRepository.findByUserId.mockResolvedValue(mockCharacterRecords);

      const result = await eveApiKeyService.getUserCharacters('user-uuid');

      expect(result).toHaveLength(2);
      expect(result[0].characterName).toBe('Test Character 1');
      expect(result[1].characterName).toBe('Test Character 2');
      expect(result[1].allianceId).toBeUndefined();
    });
  });

  describe('hasRequiredScopes', () => {
    it('should return true when character has required scopes', async () => {
      const mockCharacterRecord = {
        id: 'char-uuid',
        userId: 'user-uuid',
        characterId: 123456789,
        characterName: 'Test Character',
        corporationId: 987654321,
        allianceId: 111222333,
        encryptedApiKey: 'encrypted-api-key',
        scopes: [
          'esi-markets.read_character_orders.v1',
          'esi-wallet.read_character_wallet.v1',
          'esi-assets.read_assets.v1',
        ],
        lastSync: new Date(),
        expiresAt: new Date('2024-12-31'),
        isValid: true,
        createdAt: new Date(),
      };

      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(mockCharacterRecord);
      mockEveEsiService.hasRequiredScopes.mockReturnValue(true);

      const result = await eveApiKeyService.hasRequiredScopes('user-uuid', 123456789);

      expect(result).toBe(true);
      expect(mockEveEsiService.hasRequiredScopes).toHaveBeenCalledWith(mockCharacterRecord.scopes);
    });

    it('should return false when character not found', async () => {
      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(null);

      const result = await eveApiKeyService.hasRequiredScopes('user-uuid', 123456789);

      expect(result).toBe(false);
    });

    it('should return false when character API key is invalid', async () => {
      const mockCharacterRecord = {
        id: 'char-uuid',
        userId: 'user-uuid',
        characterId: 123456789,
        characterName: 'Test Character',
        corporationId: 987654321,
        allianceId: 111222333,
        encryptedApiKey: 'encrypted-api-key',
        scopes: ['esi-markets.read_character_orders.v1'],
        lastSync: new Date(),
        expiresAt: new Date('2024-12-31'),
        isValid: false,
        createdAt: new Date(),
      };

      mockEveCharacterRepository.findByUserIdAndCharacterId.mockResolvedValue(mockCharacterRecord);

      const result = await eveApiKeyService.hasRequiredScopes('user-uuid', 123456789);

      expect(result).toBe(false);
    });
  });
});
