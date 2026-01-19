/**
 * GET /api/auth/me
 * 현재 로그인한 사용자 정보 조회
 */

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/init";
import { hasAwsCredentials } from "@aws-internal/db/users";
import type { SessionData, UserInfo } from "@aws-internal/auth";

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(
      await cookies(),
      getSessionOptions()
    );

    if (!session.isLoggedIn) {
      return NextResponse.json({ user: null });
    }

    const userInfo: UserInfo = {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      hasAwsCredentials: hasAwsCredentials(session.userId),
    };

    return NextResponse.json({ user: userInfo });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ user: null });
  }
}
