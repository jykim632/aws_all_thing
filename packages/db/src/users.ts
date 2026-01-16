/**
 * 사용자 및 AWS Credentials CRUD
 */

import { getDb } from "./index";
import { encrypt, decrypt } from "./crypto";
import type { User, AwsCredentials } from "./types";

// ===== 사용자 =====

/**
 * 사용자 생성 또는 업데이트 (로그인 시)
 */
export function upsertUser(
  username: string,
  displayName?: string,
  email?: string
): User {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO users (username, display_name, email, last_login_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(username) DO UPDATE SET
      display_name = excluded.display_name,
      email = excluded.email,
      last_login_at = datetime('now')
    RETURNING *
  `);

  const row = stmt.get(username, displayName ?? null, email ?? null) as Record<string, unknown>;
  return mapUserRow(row);
}

/**
 * ID로 사용자 조회
 */
export function getUserById(id: number): User | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? mapUserRow(row) : null;
}

/**
 * username으로 사용자 조회
 */
export function getUserByUsername(username: string): User | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
  const row = stmt.get(username) as Record<string, unknown> | undefined;
  return row ? mapUserRow(row) : null;
}

// ===== AWS Credentials =====

/**
 * AWS credentials 저장/업데이트
 */
export function saveAwsCredentials(
  userId: number,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = "ap-northeast-2"
): void {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO aws_credentials (
      user_id,
      access_key_id_encrypted,
      secret_access_key_encrypted,
      region
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      access_key_id_encrypted = excluded.access_key_id_encrypted,
      secret_access_key_encrypted = excluded.secret_access_key_encrypted,
      region = excluded.region,
      updated_at = datetime('now')
  `);

  stmt.run(
    userId,
    encrypt(accessKeyId),
    encrypt(secretAccessKey),
    region
  );
}

/**
 * AWS credentials 조회 (복호화된 상태)
 */
export function getAwsCredentials(userId: number): AwsCredentials | null {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT access_key_id_encrypted, secret_access_key_encrypted, region
    FROM aws_credentials
    WHERE user_id = ?
  `);

  const row = stmt.get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    accessKeyId: decrypt(row.access_key_id_encrypted as string),
    secretAccessKey: decrypt(row.secret_access_key_encrypted as string),
    region: row.region as string,
  };
}

/**
 * AWS credentials 삭제
 */
export function deleteAwsCredentials(userId: number): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM aws_credentials WHERE user_id = ?");
  const result = stmt.run(userId);
  return result.changes > 0;
}

/**
 * AWS credentials 존재 여부 확인
 */
export function hasAwsCredentials(userId: number): boolean {
  const db = getDb();
  const stmt = db.prepare(
    "SELECT 1 FROM aws_credentials WHERE user_id = ? LIMIT 1"
  );
  return !!stmt.get(userId);
}

/**
 * Access Key ID만 마스킹해서 조회
 */
export function getMaskedAccessKeyId(userId: number): string | null {
  const creds = getAwsCredentials(userId);
  if (!creds) return null;

  const { accessKeyId } = creds;
  if (accessKeyId.length <= 8) return "****";
  return accessKeyId.slice(0, 4) + "****" + accessKeyId.slice(-4);
}

// ===== 헬퍼 =====

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    username: row.username as string,
    displayName: row.display_name as string | undefined,
    email: row.email as string | undefined,
    createdAt: row.created_at as string,
    lastLoginAt: row.last_login_at as string | undefined,
  };
}
