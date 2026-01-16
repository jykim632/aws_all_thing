/**
 * AWS credentials 암호화/복호화 유틸리티
 * AES-256-GCM 사용
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { getConfig } from "./index";

const ALGORITHM = "aes-256-gcm";

/**
 * SESSION_SECRET + salt에서 256비트 키 유도
 */
function getKey(): Buffer {
  const config = getConfig();
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return scryptSync(secret, config.encryptionSalt, 32);
}

/**
 * 문자열 암호화
 * @returns "iv:authTag:encrypted" 형식의 문자열
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * 암호화된 문자열 복호화
 * @param encryptedData "iv:authTag:encrypted" 형식의 문자열
 */
export function decrypt(encryptedData: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
