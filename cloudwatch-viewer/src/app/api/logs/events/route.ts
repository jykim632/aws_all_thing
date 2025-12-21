/**
 * GET /api/logs/events
 * 로그 이벤트 조회
 */

import { NextResponse } from "next/server";
import { fetchLogEvents } from "@/lib/aws/logs";

export async function GET(request: Request) {
  try {
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

    const result = await fetchLogEvents({
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
    if (message.includes("credentials")) {
      return NextResponse.json(
        {
          error: {
            code: "CREDENTIALS_ERROR",
            message: "AWS credentials not configured",
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
