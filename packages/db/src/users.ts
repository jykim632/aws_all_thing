/**
 * 사용자 및 AWS Credentials CRUD
 */

import { getDb } from "./index";
import { encrypt, decrypt } from "./crypto";
import type { User, AwsCredentials, TempCredentials, MfaStatus } from "./types";

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

// ===== MFA =====

/**
 * MFA Serial ARN 저장
 */
export function saveMfaSerial(
  userId: number,
  mfaSerial: string | null
): void {
  const db = getDb();

  const stmt = db.prepare(`
    UPDATE aws_credentials
    SET mfa_serial_encrypted = ?, updated_at = datetime('now')
    WHERE user_id = ?
  `);

  stmt.run(mfaSerial ? encrypt(mfaSerial) : null, userId);
}

/**
 * MFA Serial ARN 조회
 */
export function getMfaSerial(userId: number): string | null {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT mfa_serial_encrypted
    FROM aws_credentials
    WHERE user_id = ?
  `);

  const row = stmt.get(userId) as { mfa_serial_encrypted: string | null } | undefined;
  if (!row?.mfa_serial_encrypted) return null;

  return decrypt(row.mfa_serial_encrypted);
}

/**
 * MFA Serial ARN 마스킹 조회
 * 예: arn:aws:iam::123456789012:mfa/user → arn:aws:iam::****9012:mfa/user
 */
export function getMaskedMfaSerial(userId: number): string | null {
  const mfaSerial = getMfaSerial(userId);
  if (!mfaSerial) return null;

  // arn:aws:iam::123456789012:mfa/username 형식
  return mfaSerial.replace(/::(\d{8})(\d{4}):/, "::****$2:");
}

// ===== 임시 자격증명 =====

/**
 * 임시 자격증명 저장 (MFA 인증 후)
 */
export function saveTempCredentials(
  userId: number,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  expiresAt: Date
): void {
  const db = getDb();

  const stmt = db.prepare(`
    UPDATE aws_credentials
    SET
      temp_access_key_id_encrypted = ?,
      temp_secret_access_key_encrypted = ?,
      temp_session_token_encrypted = ?,
      temp_expires_at = ?,
      updated_at = datetime('now')
    WHERE user_id = ?
  `);

  stmt.run(
    encrypt(accessKeyId),
    encrypt(secretAccessKey),
    encrypt(sessionToken),
    expiresAt.toISOString(),
    userId
  );
}

/**
 * 유효한 임시 자격증명 조회 (만료 체크 포함)
 * 만료됐거나 없으면 null 반환
 */
export function getValidTempCredentials(userId: number): TempCredentials | null {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT
      temp_access_key_id_encrypted,
      temp_secret_access_key_encrypted,
      temp_session_token_encrypted,
      temp_expires_at
    FROM aws_credentials
    WHERE user_id = ?
  `);

  const row = stmt.get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const expiresAtStr = row.temp_expires_at as string | null;
  if (!expiresAtStr) return null;

  const expiresAt = new Date(expiresAtStr);
  // 만료 5분 전부터 무효 처리 (안전 마진)
  if (expiresAt.getTime() - 5 * 60 * 1000 <= Date.now()) {
    return null;
  }

  const accessKeyId = row.temp_access_key_id_encrypted as string | null;
  const secretAccessKey = row.temp_secret_access_key_encrypted as string | null;
  const sessionToken = row.temp_session_token_encrypted as string | null;

  if (!accessKeyId || !secretAccessKey || !sessionToken) return null;

  return {
    accessKeyId: decrypt(accessKeyId),
    secretAccessKey: decrypt(secretAccessKey),
    sessionToken: decrypt(sessionToken),
    expiresAt,
  };
}

/**
 * 임시 자격증명 삭제
 */
export function clearTempCredentials(userId: number): void {
  const db = getDb();

  const stmt = db.prepare(`
    UPDATE aws_credentials
    SET
      temp_access_key_id_encrypted = NULL,
      temp_secret_access_key_encrypted = NULL,
      temp_session_token_encrypted = NULL,
      temp_expires_at = NULL,
      updated_at = datetime('now')
    WHERE user_id = ?
  `);

  stmt.run(userId);
}

/**
 * MFA 상태 조회
 */
export function getMfaStatus(userId: number): MfaStatus {
  const mfaSerial = getMfaSerial(userId);
  const tempCreds = getValidTempCredentials(userId);

  let tempCredentialsStatus: MfaStatus["tempCredentialsStatus"] = "none";
  let tempExpiresAt: Date | null = null;

  if (mfaSerial) {
    if (tempCreds) {
      tempCredentialsStatus = "valid";
      tempExpiresAt = tempCreds.expiresAt;
    } else {
      // MFA 설정됐는데 temp creds가 없거나 만료됨
      // 만료된 케이스 체크
      const db = getDb();
      const stmt = db.prepare(`
        SELECT temp_expires_at
        FROM aws_credentials
        WHERE user_id = ?
      `);
      const row = stmt.get(userId) as { temp_expires_at: string | null } | undefined;
      if (row?.temp_expires_at) {
        tempCredentialsStatus = "expired";
      }
    }
  }

  return {
    mfaEnabled: !!mfaSerial,
    mfaSerial,
    tempCredentialsStatus,
    tempExpiresAt,
  };
}

/**
 * 실제 AWS API 호출에 사용할 자격증명 조회
 * MFA 설정 시: 유효한 임시 자격증명 우선
 * MFA 미설정 시: 장기 자격증명 사용
 */
export function getEffectiveAwsCredentials(userId: number): AwsCredentials | null {
  const baseCreds = getAwsCredentials(userId);
  if (!baseCreds) return null;

  const mfaSerial = getMfaSerial(userId);

  // MFA 미사용: 장기 자격증명 반환
  if (!mfaSerial) {
    return baseCreds;
  }

  // MFA 사용: 유효한 임시 자격증명 필요
  const tempCreds = getValidTempCredentials(userId);
  if (!tempCreds) {
    return null; // MFA 인증 필요
  }

  return {
    accessKeyId: tempCreds.accessKeyId,
    secretAccessKey: tempCreds.secretAccessKey,
    sessionToken: tempCreds.sessionToken,
    region: baseCreds.region,
  };
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
