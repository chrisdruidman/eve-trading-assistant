// Encryption utilities for EVE Trading Assistant
// AES-256 encryption for API keys and sensitive data

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface DecryptionInput {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Generate a random encryption key
 * @returns Base64 encoded encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param data - The data to encrypt
 * @param key - Base64 encoded encryption key
 * @returns Encryption result with encrypted data, IV, and authentication tag
 */
export function encryptData(data: string, key: string): EncryptionResult {
  try {
    // Convert base64 key to buffer
    const keyBuffer = Buffer.from(key, 'base64');

    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error('Invalid key length. Expected 32 bytes for AES-256.');
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher with key and IV
    const cipher = crypto.createCipherGCM(ALGORITHM, keyBuffer, iv);

    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param input - Decryption input with encrypted data, IV, and tag
 * @param key - Base64 encoded encryption key
 * @returns Decrypted data
 */
export function decryptData(input: DecryptionInput, key: string): string {
  try {
    // Convert base64 key to buffer
    const keyBuffer = Buffer.from(key, 'base64');

    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error('Invalid key length. Expected 32 bytes for AES-256.');
    }

    // Convert hex strings to buffers
    const iv = Buffer.from(input.iv, 'hex');
    const tag = Buffer.from(input.tag, 'hex');

    // Create decipher with key and IV
    const decipher = crypto.createDecipherGCM(ALGORITHM, keyBuffer, iv);

    // Set the authentication tag
    decipher.setAuthTag(tag);

    // Decrypt data
    let decrypted = decipher.update(input.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Encrypt API key for secure storage
 * @param apiKey - EVE Online API key
 * @param encryptionKey - Base64 encoded encryption key
 * @returns Encrypted API key data as JSON string
 */
export function encryptApiKey(apiKey: string, encryptionKey: string): string {
  const result = encryptData(apiKey, encryptionKey);
  return JSON.stringify(result);
}

/**
 * Decrypt API key from secure storage
 * @param encryptedApiKey - JSON string containing encrypted API key data
 * @param encryptionKey - Base64 encoded encryption key
 * @returns Decrypted API key
 */
export function decryptApiKey(encryptedApiKey: string, encryptionKey: string): string {
  try {
    const input: DecryptionInput = JSON.parse(encryptedApiKey);
    return decryptData(input, encryptionKey);
  } catch (error) {
    throw new Error(
      `API key decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Hash password using PBKDF2
 * @param password - Plain text password
 * @param salt - Salt for hashing (optional, will generate if not provided)
 * @returns Object containing hashed password and salt
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
  const hash = crypto.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha512');

  return {
    hash: hash.toString('hex'),
    salt: saltBuffer.toString('hex'),
  };
}

/**
 * Verify password against hash
 * @param password - Plain text password
 * @param hash - Stored password hash
 * @param salt - Salt used for hashing
 * @returns True if password matches
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
}

/**
 * Generate a secure random token
 * @param length - Token length in bytes (default: 32)
 * @returns Base64 encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Create HMAC signature for data integrity
 * @param data - Data to sign
 * @param secret - Secret key for HMAC
 * @returns HMAC signature
 */
export function createHmacSignature(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature
 * @param data - Original data
 * @param signature - HMAC signature to verify
 * @param secret - Secret key for HMAC
 * @returns True if signature is valid
 */
export function verifyHmacSignature(data: string, signature: string, secret: string): boolean {
  const expectedSignature = createHmacSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
