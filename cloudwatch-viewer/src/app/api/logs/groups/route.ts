/**
 * GET /api/logs/groups
 * 로그 그룹 목록 조회
 */

import { NextResponse } from "next/server";
import { fetchLogGroups } from "@/lib/aws/logs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") || undefined;

    const logGroups = await fetchLogGroups(prefix);

    return NextResponse.json({ logGroups });
  } catch (error) {
    console.error("Failed to fetch log groups:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // credentials 에러 구분
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
