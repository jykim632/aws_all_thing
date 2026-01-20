/**
 * GET /api/logs/groups
 * 로그 그룹 목록 조회 (인증 필요)
 */

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/init";
import {
  getEffectiveAwsCredentials,
  getMfaSerial,
  hasAwsCredentials,
} from "@aws-internal/db";
import { fetchLogGroups } from "@/lib/aws/logs";
import { mapAwsErrorToApiError } from "@/lib/aws/errors";
import type { SessionData } from "@aws-internal/auth";

export async function GET(request: Request) {
  let userId: number | undefined;

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

    userId = session.userId;

    // 사용자 credentials 조회
    if (!hasAwsCredentials(userId)) {
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

    // MFA 체크: MFA 설정됐는데 유효한 임시 자격증명이 없으면 MFA_REQUIRED
    const mfaSerial = getMfaSerial(userId);
    const credentials = getEffectiveAwsCredentials(userId);

    if (mfaSerial && !credentials) {
      return NextResponse.json(
        {
          error: {
            code: "MFA_REQUIRED",
            message: "MFA 인증이 필요합니다.",
          },
        },
        { status: 401 }
      );
    }

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

    const usingTempCredentials = !!credentials.sessionToken;

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") || undefined;

    const logGroups = await fetchLogGroups(credentials, prefix);

    return NextResponse.json({ logGroups });
  } catch (error) {
    console.error("Failed to fetch log groups:", error);

    // MFA 관련 에러 매핑 (임시 자격증명 사용 시에만)
    const mapped = mapAwsErrorToApiError(error, {
      source: "cloudwatch",
      usingTempCredentials: true, // 이 시점에서는 항상 true로 간주 (catch 블록)
    });

    if (mapped) {
      return NextResponse.json(
        { error: { code: mapped.code, message: mapped.message } },
        { status: mapped.httpStatus }
      );
    }

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

    // MFA 정책에 의한 deny → MFA 설정 여부에 따라 분기
    if (message.includes("explicit deny") && message.includes("MFA")) {
      const mfaSerial = userId ? getMfaSerial(userId) : null;
      const code = mfaSerial ? "MFA_REQUIRED" : "MFA_NOT_CONFIGURED";
      const msg = mfaSerial
        ? "MFA 인증이 필요합니다."
        : "이 리소스에 접근하려면 MFA 설정이 필요합니다.";

      return NextResponse.json(
        { error: { code, message: msg } },
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
