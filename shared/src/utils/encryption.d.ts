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
export declare function generateEncryptionKey(): string;
export declare function encryptData(data: string, key: string): EncryptionResult;
export declare function decryptData(input: DecryptionInput, key: string): string;
export declare function encryptApiKey(apiKey: string, encryptionKey: string): string;
export declare function decryptApiKey(encryptedApiKey: string, encryptionKey: string): string;
export declare function hashPassword(password: string, salt?: string): {
    hash: string;
    salt: string;
};
export declare function verifyPassword(password: string, hash: string, salt: string): boolean;
export declare function generateSecureToken(length?: number): string;
export declare function createHmacSignature(data: string, secret: string): string;
export declare function verifyHmacSignature(data: string, signature: string, secret: string): boolean;
//# sourceMappingURL=encryption.d.ts.map