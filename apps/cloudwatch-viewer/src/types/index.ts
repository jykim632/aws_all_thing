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
});

export type CredentialsRequest = z.infer<typeof CredentialsRequestSchema>;
