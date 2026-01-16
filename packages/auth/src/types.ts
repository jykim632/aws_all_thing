/**
 * 인증 관련 타입 정의 (Zod 스키마 + 타입)
 */

import { z } from "zod";

// ===== 세션 설정 =====

export interface SessionConfig {
  cookieName: string;
  maxAge?: number; // 기본 8시간 (28800초)
}

// ===== 세션 데이터 =====

export const SessionDataSchema = z.object({
  isLoggedIn: z.boolean(),
  userId: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
});

export type SessionData = z.infer<typeof SessionDataSchema>;

// ===== LDAP 사용자 =====

export interface LdapUser {
  username: string;
  displayName?: string;
  email?: string;
}

// ===== API 요청 =====

// LDAP injection 방지용 화이트리스트
const SAFE_USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

export const LoginRequestSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(64, "Username too long")
    .regex(SAFE_USERNAME_REGEX, "Username contains invalid characters"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ===== API 응답 =====

export const UserInfoSchema = z.object({
  id: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
  hasAwsCredentials: z.boolean(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;
