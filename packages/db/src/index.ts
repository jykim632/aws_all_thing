/**
 * SQLite 데이터베이스 싱글톤
 */

import { mkdirSync } from "fs";
import { dirname } from "path";
import Database from "better-sqlite3";
import type { DbConfig } from "./types";

let db: Database.Database | null = null;
let config: DbConfig | null = null;

/**
 * DB 초기화 (앱 시작 시 1회 호출)
 */
export function initDb(cfg: DbConfig): void {
  config = cfg;
}

/**
 * 현재 설정 반환 (내부용)
 */
export function getConfig(): DbConfig {
  if (!config) {
    throw new Error("DB not initialized. Call initDb() first.");
  }
  return config;
}

/**
 * SQLite 데이터베이스 인스턴스 반환
 * 처음 호출 시 연결, 이후 재사용
 */
export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  if (!config) {
    throw new Error("DB not initialized. Call initDb() first.");
  }

  // 디렉토리 없으면 생성
  const dir = dirname(config.dbPath);
  mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

/**
 * 데이터베이스 연결 종료 (테스트용)
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Re-export
export type { DbConfig, AwsCredentials, TempCredentials, MfaStatus } from "./types";
export {
  // 사용자
  upsertUser,
  getUserById,
  getUserByUsername,
  // AWS Credentials
  saveAwsCredentials,
  getAwsCredentials,
  deleteAwsCredentials,
  hasAwsCredentials,
  getMaskedAccessKeyId,
  // MFA
  saveMfaSerial,
  getMfaSerial,
  getMaskedMfaSerial,
  // 임시 자격증명
  saveTempCredentials,
  getValidTempCredentials,
  clearTempCredentials,
  getMfaStatus,
  getEffectiveAwsCredentials,
} from "./users";
export { initSchema } from "./schema";
