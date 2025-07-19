"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEncryptionKey = generateEncryptionKey;
exports.encryptData = encryptData;
exports.decryptData = decryptData;
exports.encryptApiKey = encryptApiKey;
exports.decryptApiKey = decryptApiKey;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateSecureToken = generateSecureToken;
exports.createHmacSignature = createHmacSignature;
exports.verifyHmacSignature = verifyHmacSignature;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
function generateEncryptionKey() {
    return crypto_1.default.randomBytes(KEY_LENGTH).toString('base64');
}
function encryptData(data, key) {
    try {
        const keyBuffer = Buffer.from(key, 'base64');
        if (keyBuffer.length !== KEY_LENGTH) {
            throw new Error('Invalid key length. Expected 32 bytes for AES-256.');
        }
        const iv = crypto_1.default.randomBytes(IV_LENGTH);
        const cipher = crypto_1.default.createCipher(ALGORITHM, keyBuffer);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
        };
    }
    catch (error) {
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
function decryptData(input, key) {
    try {
        const keyBuffer = Buffer.from(key, 'base64');
        if (keyBuffer.length !== KEY_LENGTH) {
            throw new Error('Invalid key length. Expected 32 bytes for AES-256.');
        }
        const iv = Buffer.from(input.iv, 'hex');
        const tag = Buffer.from(input.tag, 'hex');
        const decipher = crypto_1.default.createDecipher(ALGORITHM, keyBuffer);
        decipher.setAAD(iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(input.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
function encryptApiKey(apiKey, encryptionKey) {
    const result = encryptData(apiKey, encryptionKey);
    return JSON.stringify(result);
}
function decryptApiKey(encryptedApiKey, encryptionKey) {
    try {
        const input = JSON.parse(encryptedApiKey);
        return decryptData(input, encryptionKey);
    }
    catch (error) {
        throw new Error(`API key decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
function hashPassword(password, salt) {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto_1.default.randomBytes(32);
    const hash = crypto_1.default.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha512');
    return {
        hash: hash.toString('hex'),
        salt: saltBuffer.toString('hex'),
    };
}
function verifyPassword(password, hash, salt) {
    const { hash: computedHash } = hashPassword(password, salt);
    return crypto_1.default.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
}
function generateSecureToken(length = 32) {
    return crypto_1.default.randomBytes(length).toString('base64url');
}
function createHmacSignature(data, secret) {
    return crypto_1.default.createHmac('sha256', secret).update(data).digest('hex');
}
function verifyHmacSignature(data, signature, secret) {
    const expectedSignature = createHmacSignature(data, secret);
    return crypto_1.default.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}
//# sourceMappingURL=encryption.js.map