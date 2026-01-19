/**
 * DB 관련 타입 정의 (Zod 스키마 + 타입)
 */

import { z } from "zod";

// ===== DB 설정 =====

export interface DbConfig {
  dbPath: string;
  encryptionSalt: string;
}

// ===== 사용자 =====

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  createdAt: z.string(),
  lastLoginAt: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

// ===== AWS Credentials =====

export const AwsCredentialsSchema = z.object({
  accessKeyId: z.string().min(16).max(128),
  secretAccessKey: z.string().min(1),
  region: z.string().default("ap-northeast-2"),
  sessionToken: z.string().optional(), // 임시 자격증명용
});

export type AwsCredentials = z.infer<typeof AwsCredentialsSchema>;

// ===== MFA 관련 =====

export const TempCredentialsSchema = z.object({
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  sessionToken: z.string(),
  expiresAt: z.date(),
});

export type TempCredentials = z.infer<typeof TempCredentialsSchema>;

export interface MfaStatus {
  mfaEnabled: boolean;
  mfaSerial: string | null;
  tempCredentialsStatus: "valid" | "expired" | "none";
  tempExpiresAt: Date | null;
}
