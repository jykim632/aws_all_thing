/**
 * 앱 초기화
 * - DB 설정 (경로, 암호화 salt)
 * - 세션 설정
 */

import path from "path";
import { initDb } from "@aws-internal/db";
import { createSessionOptions } from "@aws-internal/auth";

// DB 초기화 (앱 시작 시 1회)
initDb({
  dbPath: path.join(process.cwd(), "data", "cloudwatch-viewer.db"),
  encryptionSalt: "cloudwatch-viewer-salt", // 기존 데이터 호환성 유지!
});

// 세션 옵션
export const sessionOptions = createSessionOptions({
  cookieName: "cloudwatch-session",
});
