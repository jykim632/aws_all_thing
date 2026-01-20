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

// PATCH: 필드별 부분 업데이트
export const CredentialsPatchSchema = z
  .object({
    accessKeyId: z.string().min(16, "Access Key ID must be at least 16 characters").optional(),
    secretAccessKey: z.string().min(1, "Secret Access Key is required").optional(),
    region: z.string().optional(),
    mfaSerial: z
      .string()
      .regex(/^arn:aws:iam::\d{12}:mfa\/.+$/, "Invalid MFA ARN format")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      // accessKeyId와 secretAccessKey는 둘 다 있거나 둘 다 없어야 함
      const hasAccessKey = data.accessKeyId !== undefined;
      const hasSecretKey = data.secretAccessKey !== undefined;
      return hasAccessKey === hasSecretKey;
    },
    { message: "accessKeyId and secretAccessKey must be provided together" }
  )
  .refine(
    (data) => {
      // 최소 하나의 필드는 있어야 함
      return Object.values(data).some((v) => v !== undefined);
    },
    { message: "At least one field must be provided" }
  );

export type CredentialsPatch = z.infer<typeof CredentialsPatchSchema>;

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

// API 에러 응답 Zod 스키마 (런타임 파싱용)
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

// 클라이언트 에러 상태 타입
export interface UiError {
  code?: string;
  message: string;
}

// MFA 관련 에러 코드
export type MfaErrorCode =
  | "MFA_REQUIRED"
  | "MFA_SESSION_EXPIRED"
  | "MFA_NOT_CONFIGURED"
  | "INVALID_MFA_TOKEN"
  | "STS_ERROR";
