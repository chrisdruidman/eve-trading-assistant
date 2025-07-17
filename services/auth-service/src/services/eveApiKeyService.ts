import { EveCharacterRepository, EveCharacterRecord } from '../models/eveCharacterRepository';
import { EveEsiService, EsiRateLimitError } from './eveEsiService';
import {
  encryptApiKey,
  decryptApiKey,
  generateEncryptionKey,
} from '../../../../shared/src/utils/encryption';
import { EveCharacter, EveApiKeyInfo } from '../../../../shared/src/types';

export interface AddApiKeyRequest {
  userId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  character?: EveCharacter;
  error?: string;
}

export class EveApiKeyService {
  private encryptionKey: string;

  constructor(
    private eveCharacterRepository: EveCharacterRepository,
    private eveEsiService: EveEsiService
  ) {
    // In production, this should come from environment variables or secure key management
    this.encryptionKey = process.env.EVE_API_ENCRYPTION_KEY || generateEncryptionKey();

    if (!process.env.EVE_API_ENCRYPTION_KEY) {
      console.warn(
        '⚠️  EVE_API_ENCRYPTION_KEY not set. Using generated key (not recommended for production)'
      );
    }
  }

  /**
   * Add and validate a new EVE Online API key for a user
   * @param request - API key addition request
   * @returns Character information if successful
   */
  async addApiKey(request: AddApiKeyRequest): Promise<EveCharacter> {
    try {
      // Validate the API key with EVE Online
      const apiKeyInfo = await this.eveEsiService.validateApiKey(request.accessToken);

      // Check if character already exists for this user
      const existingCharacter = await this.eveCharacterRepository.findByUserIdAndCharacterId(
        request.userId,
        apiKeyInfo.characterId
      );

      if (existingCharacter) {
        // Update existing character with new API key
        return this.updateExistingCharacter(existingCharacter, request.accessToken, apiKeyInfo);
      }

      // Get detailed character information
      const characterInfo = await this.eveEsiService.getCharacterInfo(
        apiKeyInfo.characterId,
        request.accessToken
      );

      // Encrypt the API key for storage
      const encryptedApiKey = encryptApiKey(request.accessToken, this.encryptionKey);

      // Create new character record
      const characterRecord = await this.eveCharacterRepository.create({
        userId: request.userId,
        characterId: apiKeyInfo.characterId,
        characterName: apiKeyInfo.characterName,
        corporationId: characterInfo.corporation_id,
        allianceId: characterInfo.alliance_id,
        encryptedApiKey,
        scopes: apiKeyInfo.scopes,
        lastSync: new Date(),
        expiresAt: apiKeyInfo.expiresAt,
        isValid: true,
      });

      return this.mapRecordToCharacter(characterRecord);
    } catch (error) {
      if (error instanceof EsiRateLimitError) {
        throw new Error(
          `EVE API rate limit exceeded. Please try again in ${error.retryAfter} seconds.`
        );
      }

      throw new Error(
        `Failed to add API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all characters for a user
   * @param userId - User ID
   * @returns Array of user's EVE characters
   */
  async getUserCharacters(userId: string): Promise<EveCharacter[]> {
    const characterRecords = await this.eveCharacterRepository.findByUserId(userId);
    return characterRecords.map(record => this.mapRecordToCharacter(record));
  }

  /**
   * Validate an existing API key
   * @param userId - User ID
   * @param characterId - Character ID
   * @returns Validation result
   */
  async validateApiKey(userId: string, characterId: number): Promise<ApiKeyValidationResult> {
    try {
      const characterRecord = await this.eveCharacterRepository.findByUserIdAndCharacterId(
        userId,
        characterId
      );

      if (!characterRecord) {
        return {
          isValid: false,
          error: 'Character not found',
        };
      }

      // Decrypt the API key
      const accessToken = decryptApiKey(characterRecord.encryptedApiKey, this.encryptionKey);

      // Validate with EVE Online
      const apiKeyInfo = await this.eveEsiService.validateApiKey(accessToken);

      // Update last sync time
      await this.eveCharacterRepository.updateLastSync(userId, characterId);

      return {
        isValid: true,
        character: this.mapRecordToCharacter(characterRecord),
      };
    } catch (error) {
      // Mark API key as invalid if validation fails
      await this.eveCharacterRepository.markAsInvalid(userId, characterId);

      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Refresh character information from EVE Online
   * @param userId - User ID
   * @param characterId - Character ID
   * @returns Updated character information
   */
  async refreshCharacterInfo(userId: string, characterId: number): Promise<EveCharacter> {
    const characterRecord = await this.eveCharacterRepository.findByUserIdAndCharacterId(
      userId,
      characterId
    );

    if (!characterRecord) {
      throw new Error('Character not found');
    }

    if (!characterRecord.isValid) {
      throw new Error('API key is invalid. Please re-add your character.');
    }

    try {
      // Decrypt the API key
      const accessToken = decryptApiKey(characterRecord.encryptedApiKey, this.encryptionKey);

      // Get updated character information
      const characterInfo = await this.eveEsiService.getCharacterInfo(characterId, accessToken);

      // Update character record (corporation/alliance might have changed)
      const updatedRecord = await this.eveCharacterRepository.create({
        ...characterRecord,
        corporationId: characterInfo.corporation_id,
        allianceId: characterInfo.alliance_id,
        lastSync: new Date(),
      });

      return this.mapRecordToCharacter(updatedRecord);
    } catch (error) {
      // Mark as invalid if refresh fails
      await this.eveCharacterRepository.markAsInvalid(userId, characterId);

      throw new Error(
        `Failed to refresh character info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove a character and its API key
   * @param userId - User ID
   * @param characterId - Character ID
   * @returns True if character was removed
   */
  async removeCharacter(userId: string, characterId: number): Promise<boolean> {
    return this.eveCharacterRepository.delete(userId, characterId);
  }

  /**
   * Get characters with API keys expiring soon
   * @param daysAhead - Number of days to look ahead (default: 7)
   * @returns Characters with expiring API keys
   */
  async getCharactersWithExpiringKeys(daysAhead: number = 7): Promise<EveCharacter[]> {
    const characterRecords = await this.eveCharacterRepository.findExpiringSoon(daysAhead);
    return characterRecords.map(record => this.mapRecordToCharacter(record));
  }

  /**
   * Check if a character has required scopes for trading
   * @param userId - User ID
   * @param characterId - Character ID
   * @returns True if character has required scopes
   */
  async hasRequiredScopes(userId: string, characterId: number): Promise<boolean> {
    const characterRecord = await this.eveCharacterRepository.findByUserIdAndCharacterId(
      userId,
      characterId
    );

    if (!characterRecord || !characterRecord.isValid) {
      return false;
    }

    return this.eveEsiService.hasRequiredScopes(characterRecord.scopes);
  }

  /**
   * Get decrypted API key for internal use (be very careful with this)
   * @param userId - User ID
   * @param characterId - Character ID
   * @returns Decrypted API key
   */
  async getDecryptedApiKey(userId: string, characterId: number): Promise<string> {
    const characterRecord = await this.eveCharacterRepository.findByUserIdAndCharacterId(
      userId,
      characterId
    );

    if (!characterRecord) {
      throw new Error('Character not found');
    }

    if (!characterRecord.isValid) {
      throw new Error('API key is invalid');
    }

    return decryptApiKey(characterRecord.encryptedApiKey, this.encryptionKey);
  }

  /**
   * Update existing character with new API key information
   */
  private async updateExistingCharacter(
    existingCharacter: EveCharacterRecord,
    accessToken: string,
    apiKeyInfo: EveApiKeyInfo
  ): Promise<EveCharacter> {
    // Encrypt the new API key
    const encryptedApiKey = encryptApiKey(accessToken, this.encryptionKey);

    // Update the character record
    const updatedRecord = await this.eveCharacterRepository.updateApiKey(
      existingCharacter.userId,
      existingCharacter.characterId,
      encryptedApiKey,
      apiKeyInfo.expiresAt,
      apiKeyInfo.scopes
    );

    if (!updatedRecord) {
      throw new Error('Failed to update character API key');
    }

    return this.mapRecordToCharacter(updatedRecord);
  }

  /**
   * Map database record to EveCharacter type
   */
  private mapRecordToCharacter(record: EveCharacterRecord): EveCharacter {
    return {
      characterId: record.characterId,
      characterName: record.characterName,
      corporationId: record.corporationId,
      allianceId: record.allianceId,
      apiKey: record.encryptedApiKey, // Keep encrypted for security
      scopes: record.scopes,
      lastSync: record.lastSync,
    };
  }
}
