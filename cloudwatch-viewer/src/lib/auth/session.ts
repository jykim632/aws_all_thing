/**
 * iron-session 설정
 */

import { SessionOptions } from "iron-session";
import type { SessionData } from "@/types";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "cloudwatch-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 8 * 60 * 60, // 8시간
  },
};

// 기본 세션 (로그인 안 됨)
export const defaultSession: SessionData = {
  isLoggedIn: false,
  userId: 0,
  username: "",
};
