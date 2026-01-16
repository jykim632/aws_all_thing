/**
 * iron-session 설정
 */

import { SessionOptions } from "iron-session";
import type { SessionConfig, SessionData } from "./types";

/**
 * 세션 옵션 생성 (앱별 설정 가능)
 */
export function createSessionOptions(config: SessionConfig): SessionOptions {
  return {
    password: process.env.SESSION_SECRET!,
    cookieName: config.cookieName,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      maxAge: config.maxAge ?? 8 * 60 * 60, // 기본 8시간
    },
  };
}

/**
 * 기본 세션 (로그인 안 됨)
 */
export const defaultSession: SessionData = {
  isLoggedIn: false,
  userId: 0,
  username: "",
};
