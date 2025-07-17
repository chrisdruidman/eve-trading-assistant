import axios, { AxiosInstance, AxiosError } from 'axios';
import { EveApiKeyInfo } from '../../../../shared/src/types';

export interface EveCharacterInfo {
  character_id: number;
  name: string;
  corporation_id: number;
  alliance_id?: number;
  birthday: string;
  gender: string;
  race_id: number;
  bloodline_id: number;
  ancestry_id: number;
  security_status?: number;
}

export interface EveCorporationInfo {
  name: string;
  ticker: string;
  member_count: number;
  alliance_id?: number;
}

export interface EveAllianceInfo {
  name: string;
  ticker: string;
}

export interface EveTokenInfo {
  CharacterID: number;
  CharacterName: string;
  ExpiresOn: string;
  Scopes: string;
  TokenType: string;
  CharacterOwnerHash: string;
  IntellectualProperty: string;
}

export class EveEsiService {
  private client: AxiosInstance;
  private readonly baseUrl = 'https://esi.evetech.net/latest';
  private readonly loginUrl = 'https://login.eveonline.com';

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'EVE-Trading-Assistant/1.0.0 (contact@example.com)',
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Rate limited - extract retry-after header
          const retryAfter = error.response.headers['retry-after'];
          throw new EsiRateLimitError('ESI API rate limit exceeded', parseInt(retryAfter) || 60);
        }
        throw error;
      }
    );
  }

  /**
   * Validate EVE Online API key by verifying the token
   * @param accessToken - EVE Online access token
   * @returns API key information
   */
  async validateApiKey(accessToken: string): Promise<EveApiKeyInfo> {
    try {
      // Verify token with EVE Online
      const tokenInfo = await this.verifyToken(accessToken);

      // Get character information
      const characterInfo = await this.getCharacterInfo(tokenInfo.CharacterID, accessToken);

      return {
        characterId: tokenInfo.CharacterID,
        characterName: tokenInfo.CharacterName,
        scopes: tokenInfo.Scopes.split(' ').filter(scope => scope.length > 0),
        expiresAt: new Date(tokenInfo.ExpiresOn),
        isValid: true,
      };
    } catch (error) {
      if (error instanceof EsiRateLimitError) {
        throw error;
      }

      throw new Error(
        `API key validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify access token with EVE Online
   * @param accessToken - EVE Online access token
   * @returns Token information
   */
  private async verifyToken(accessToken: string): Promise<EveTokenInfo> {
    try {
      const response = await axios.get(`${this.loginUrl}/oauth/verify`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'EVE-Trading-Assistant/1.0.0 (contact@example.com)',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid or expired access token');
        }
        if (error.response?.status === 403) {
          throw new Error('Access token lacks required permissions');
        }
      }
      throw new Error('Failed to verify access token');
    }
  }

  /**
   * Get character information from ESI
   * @param characterId - EVE character ID
   * @param accessToken - Access token (optional, for authenticated requests)
   * @returns Character information
   */
  async getCharacterInfo(characterId: number, accessToken?: string): Promise<EveCharacterInfo> {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await this.client.get(`${this.baseUrl}/characters/${characterId}/`, {
        headers,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Character not found');
        }
        if (error.response?.status === 403) {
          throw new Error('Access denied - insufficient permissions');
        }
      }
      throw new Error('Failed to fetch character information');
    }
  }

  /**
   * Get corporation information from ESI
   * @param corporationId - EVE corporation ID
   * @returns Corporation information
   */
  async getCorporationInfo(corporationId: number): Promise<EveCorporationInfo> {
    try {
      const response = await this.client.get(`${this.baseUrl}/corporations/${corporationId}/`);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Corporation not found');
        }
      }
      throw new Error('Failed to fetch corporation information');
    }
  }

  /**
   * Get alliance information from ESI
   * @param allianceId - EVE alliance ID
   * @returns Alliance information
   */
  async getAllianceInfo(allianceId: number): Promise<EveAllianceInfo> {
    try {
      const response = await this.client.get(`${this.baseUrl}/alliances/${allianceId}/`);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Alliance not found');
        }
      }
      throw new Error('Failed to fetch alliance information');
    }
  }

  /**
   * Check if character has required scopes for trading operations
   * @param scopes - Array of scopes from the token
   * @returns True if character has required scopes
   */
  hasRequiredScopes(scopes: string[]): boolean {
    const requiredScopes = [
      'esi-markets.read_character_orders.v1',
      'esi-wallet.read_character_wallet.v1',
      'esi-assets.read_assets.v1',
    ];

    return requiredScopes.every(required => scopes.includes(required));
  }

  /**
   * Get recommended scopes for the application
   * @returns Array of recommended scopes
   */
  getRecommendedScopes(): string[] {
    return [
      'esi-markets.read_character_orders.v1',
      'esi-wallet.read_character_wallet.v1',
      'esi-assets.read_assets.v1',
      'esi-characters.read_contacts.v1',
      'esi-location.read_location.v1',
      'esi-location.read_ship_type.v1',
    ];
  }

  /**
   * Generate EVE Online OAuth URL for authorization
   * @param clientId - EVE application client ID
   * @param redirectUri - Redirect URI after authorization
   * @param state - State parameter for CSRF protection
   * @returns Authorization URL
   */
  generateAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const scopes = this.getRecommendedScopes().join(' ');
    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: redirectUri,
      client_id: clientId,
      scope: scopes,
      state: state,
    });

    return `${this.loginUrl}/v2/oauth/authorize/?${params.toString()}`;
  }
}

export class EsiRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'EsiRateLimitError';
  }
}

export class EsiApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'EsiApiError';
  }
}
