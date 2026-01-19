/**
 * POST /api/auth/login
 * LDAP 인증 및 세션 생성
 */

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/init";
import {
  authenticateWithLdap,
  LoginRequestSchema,
  type SessionData,
} from "@aws-internal/auth";
import { upsertUser } from "@aws-internal/db/users";
import { initSchema } from "@aws-internal/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 요청 검증
    const parseResult = LoginRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "Invalid request",
          },
        },
        { status: 400 }
      );
    }

    const { username, password } = parseResult.data;

    // LDAP 인증
    const ldapUser = await authenticateWithLdap(username, password);
    if (!ldapUser) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid username or password",
          },
        },
        { status: 401 }
      );
    }

    // DB 스키마 초기화 (최초 1회)
    initSchema();

    // 사용자 생성/업데이트
    const user = upsertUser(
      ldapUser.username,
      ldapUser.displayName,
      ldapUser.email
    );

    // 세션 생성
    const session = await getIronSession<SessionData>(
      await cookies(),
      getSessionOptions()
    );

    session.isLoggedIn = true;
    session.userId = user.id;
    session.username = user.username;
    session.displayName = user.displayName;
    await session.save();

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
