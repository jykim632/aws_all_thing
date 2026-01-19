/**
 * crypto.ts 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb } from "./index";
import { encrypt, decrypt } from "./crypto";

const TEST_SALT = "test-salt";
const TEST_SECRET = "test-secret-key-at-least-32-characters-long";

describe("crypto", () => {
  beforeEach(() => {
    initDb({ dbPath: ":memory:", encryptionSalt: TEST_SALT });
    vi.stubEnv("SESSION_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("encrypt/decrypt 왕복", () => {
    it("일반 문자열", () => {
      const original = "hello world";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it("한글 및 특수문자", () => {
      const original = "안녕하세요! @#$%^&*()";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it("JSON 문자열", () => {
      const original = JSON.stringify({ accessKeyId: "AKIA...", secretAccessKey: "secret" });
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });
  });

  describe("암호화 형식", () => {
    it("iv:authTag:encrypted 형식", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(32); // 16 bytes = 32 hex chars (iv)
      expect(parts[1].length).toBe(32); // 16 bytes = 32 hex chars (authTag)
      expect(parts[2].length).toBeGreaterThan(0); // encrypted data
    });

    it("같은 입력도 매번 다른 결과 (랜덤 IV)", () => {
      const text = "same text";
      const enc1 = encrypt(text);
      const enc2 = encrypt(text);
      expect(enc1).not.toBe(enc2);
      // 둘 다 복호화는 되어야 함
      expect(decrypt(enc1)).toBe(text);
      expect(decrypt(enc2)).toBe(text);
    });
  });

  describe("복호화 실패", () => {
    it("다른 키로 복호화 시 실패", () => {
      const encrypted = encrypt("secret data");

      // 다른 키로 변경
      vi.stubEnv("SESSION_SECRET", "different-secret-key-32-chars-long");
      initDb({ dbPath: ":memory:", encryptionSalt: TEST_SALT });

      expect(() => decrypt(encrypted)).toThrow();
    });

    it("다른 salt로 복호화 시 실패", () => {
      const encrypted = encrypt("secret data");

      // 다른 salt로 변경
      initDb({ dbPath: ":memory:", encryptionSalt: "different-salt" });

      expect(() => decrypt(encrypted)).toThrow();
    });

    it("잘못된 형식 - 파트 부족", () => {
      expect(() => decrypt("invalid")).toThrow("Invalid encrypted data format");
      expect(() => decrypt("part1:part2")).toThrow("Invalid encrypted data format");
    });

    it("잘못된 형식 - 빈 파트", () => {
      expect(() => decrypt("::")).toThrow("Invalid encrypted data format");
    });

    it("변조된 authTag", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      parts[1] = "0".repeat(32); // authTag 변조
      expect(() => decrypt(parts.join(":"))).toThrow();
    });

    it("변조된 데이터", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      parts[2] = "00" + parts[2].slice(2); // 첫 바이트 변조
      expect(() => decrypt(parts.join(":"))).toThrow();
    });
  });

  describe("SESSION_SECRET 검증", () => {
    it("SESSION_SECRET 없으면 에러", () => {
      vi.stubEnv("SESSION_SECRET", "");

      expect(() => encrypt("test")).toThrow("SESSION_SECRET is not configured");
    });

    it("SESSION_SECRET undefined면 에러", () => {
      vi.unstubAllEnvs();
      delete process.env.SESSION_SECRET;

      expect(() => encrypt("test")).toThrow("SESSION_SECRET is not configured");
    });
  });
});
