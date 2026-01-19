/**
 * GET /api/logs/events
 * 로그 이벤트 조회 (인증 필요)
 */

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/init";
import { getAwsCredentials } from "@aws-internal/db/users";
import { fetchLogEvents } from "@/lib/aws/logs";
import type { SessionData } from "@aws-internal/auth";

export async function GET(request: Request) {
  try {
    // 세션 확인
    const session = await getIronSession<SessionData>(
      await cookies(),
      getSessionOptions()
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

    // 필수 파라미터 검증
    const logGroupName = searchParams.get("logGroupName");
    if (!logGroupName) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_PARAM",
            message: "logGroupName is required",
          },
        },
        { status: 400 }
      );
    }

    // 시간 범위 파라미터
    const startTimeParam = searchParams.get("startTime");
    const endTimeParam = searchParams.get("endTime");

    // 기본값: 최근 1시간
    const now = Date.now();
    const startTime = startTimeParam ? Number(startTimeParam) : now - 60 * 60 * 1000;
    const endTime = endTimeParam ? Number(endTimeParam) : now;

    // 선택 파라미터
    const filterPattern = searchParams.get("filterPattern") || undefined;
    const limit = Number(searchParams.get("limit")) || 100;
    const nextToken = searchParams.get("nextToken") || undefined;

    const result = await fetchLogEvents(credentials, {
      logGroupName,
      startTime,
      endTime,
      filterPattern,
      limit,
      nextToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch log events:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // 에러 유형별 처리
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

    if (message.includes("ResourceNotFoundException")) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Log group not found",
          },
        },
        { status: 404 }
      );
    }

    if (message.includes("ThrottlingException")) {
      return NextResponse.json(
        {
          error: {
            code: "THROTTLING",
            message: "Rate limit exceeded. Please try again.",
            retryAfter: 1000,
          },
        },
        { status: 429 }
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
