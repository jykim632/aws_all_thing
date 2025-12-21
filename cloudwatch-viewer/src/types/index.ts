/**
 * 세션 및 사용자 관련 타입 정의 (Zod 스키마 + 타입)
 */

import { z } from "zod";

// ===== 세션 =====

export const SessionDataSchema = z.object({
  isLoggedIn: z.boolean(),
  userId: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
});

export type SessionData = z.infer<typeof SessionDataSchema>;

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
});

export type AwsCredentials = z.infer<typeof AwsCredentialsSchema>;

// ===== API 요청/응답 =====

export const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const CredentialsRequestSchema = z.object({
  accessKeyId: z.string().min(16, "Access Key ID must be at least 16 characters"),
  secretAccessKey: z.string().min(1, "Secret Access Key is required"),
  region: z.string().optional(),
});

export type CredentialsRequest = z.infer<typeof CredentialsRequestSchema>;

// API 응답용 사용자 정보
export const UserInfoSchema = z.object({
  id: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
  hasAwsCredentials: z.boolean(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;
