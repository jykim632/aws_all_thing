/**
 * 데이터베이스 스키마 초기화
 */

import { getDb } from "./index";

/**
 * 테이블 생성 (없으면 생성)
 */
export function initSchema(): void {
  const db = getDb();

  db.exec(`
    -- 사용자 테이블
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    -- AWS Credentials 테이블 (암호화 저장)
    CREATE TABLE IF NOT EXISTS aws_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      access_key_id_encrypted TEXT NOT NULL,
      secret_access_key_encrypted TEXT NOT NULL,
      region TEXT DEFAULT 'ap-northeast-2',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_aws_credentials_user_id
    ON aws_credentials(user_id);
  `);
}
