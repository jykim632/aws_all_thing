/**
 * 앱 전용 타입 정의 (Zod 스키마 + 타입)
 * 공통 타입은 @aws-internal/* 패키지에서 import
 */

import { z } from "zod";

// ===== API 요청 =====

export const CredentialsRequestSchema = z.object({
  accessKeyId: z.string().min(16, "Access Key ID must be at least 16 characters"),
  secretAccessKey: z.string().min(1, "Secret Access Key is required"),
  region: z.string().optional(),
  mfaSerial: z
    .string()
    .regex(/^arn:aws:iam::\d{12}:mfa\/.+$/, "Invalid MFA ARN format")
    .optional(),
});

export type CredentialsRequest = z.infer<typeof CredentialsRequestSchema>;

export const MfaSessionRequestSchema = z.object({
  tokenCode: z.string().regex(/^\d{6}$/, "MFA code must be 6 digits"),
});

export type MfaSessionRequest = z.infer<typeof MfaSessionRequestSchema>;

// ===== API 응답 =====

export interface CredentialsResponse {
  hasCredentials: boolean;
  accessKeyIdMasked: string | null;
  region: string;
  mfaEnabled: boolean;
  mfaSerialMasked: string | null;
  tempCredentialsStatus: "valid" | "expired" | "none";
  tempExpiresAt: string | null;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// MFA 관련 에러 코드
export type MfaErrorCode =
  | "MFA_REQUIRED"
  | "MFA_SESSION_EXPIRED"
  | "MFA_NOT_CONFIGURED"
  | "INVALID_MFA_TOKEN"
  | "STS_ERROR";
