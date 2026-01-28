import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.COOKIE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("COOKIE_ENCRYPTION_KEY environment variable is not set");
  }
  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error(
      "COOKIE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)"
    );
  }
  return Buffer.from(key, "hex");
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Encrypts data using AES-256-GCM
 * Used to securely store MGM session cookies
 */
export function encrypt(data: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts data encrypted with AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, "base64");
  const tag = Buffer.from(encryptedData.tag, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData.encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypts MGM session data (cookies and metadata)
 */
export function encryptMgmSession(sessionData: object): EncryptedData {
  // Never log or expose the session data
  const jsonString = JSON.stringify(sessionData);
  return encrypt(jsonString);
}

/**
 * Decrypts MGM session data
 */
export function decryptMgmSession<T>(encryptedData: EncryptedData): T {
  const jsonString = decrypt(encryptedData);
  return JSON.parse(jsonString) as T;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate a one-time code for local connector (6 alphanumeric chars)
 */
export function generateConnectorCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluded confusing chars
  let code = "";
  const randomBytesBuffer = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytesBuffer[i] % chars.length];
  }
  return code;
}
