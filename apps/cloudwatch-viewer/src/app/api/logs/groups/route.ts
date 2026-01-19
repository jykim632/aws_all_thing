/**
 * GET /api/logs/groups
 * 로그 그룹 목록 조회 (인증 필요)
 */

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/init";
import { getAwsCredentials } from "@aws-internal/db/users";
import { fetchLogGroups } from "@/lib/aws/logs";
import type { SessionData } from "@aws-internal/auth";

export async function GET(request: Request) {
  try {
    // 세션 확인
    const session = await getIronSession<SessionData>(
      await cookies(),
      sessionOptions
    );

    if (!session.isLoggedIn) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Login required",
          },
        },
        { status: 401 }
      );
    }

    // 사용자 credentials 조회
    const credentials = getAwsCredentials(session.userId);
    if (!credentials) {
      return NextResponse.json(
        {
          error: {
            code: "NO_CREDENTIALS",
            message: "AWS credentials not configured. Go to Settings.",
          },
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") || undefined;

    const logGroups = await fetchLogGroups(credentials, prefix);

    return NextResponse.json({ logGroups });
  } catch (error) {
    console.error("Failed to fetch log groups:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // AWS 에러 구분
    if (message.includes("InvalidSignatureException") ||
        message.includes("UnrecognizedClientException")) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "AWS credentials are invalid. Please update in Settings.",
          },
        },
        { status: 401 }
      );
    }

    if (message.includes("AccessDenied")) {
      return NextResponse.json(
        {
          error: {
            code: "ACCESS_DENIED",
            message: "Access denied. Check IAM permissions.",
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "AWS_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
