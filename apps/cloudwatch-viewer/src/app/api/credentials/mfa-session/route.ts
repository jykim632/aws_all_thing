/**
 * POST /api/credentials/mfa-session
 * OTP 코드로 임시 자격증명 발급
 */

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/init";
import {
  getAwsCredentials,
  getMfaSerial,
  saveTempCredentials,
} from "@aws-internal/db";
import { getMfaSession } from "@/lib/aws/sts";
import { mapAwsErrorToApiError } from "@/lib/aws/errors";
import { MfaSessionRequestSchema } from "@/types";
import type { SessionData } from "@aws-internal/auth";

export async function POST(request: Request) {
  try {
    // 세션 확인
    const session = await getIronSession<SessionData>(
      await cookies(),
      getSessionOptions()
    );

    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Login required" } },
        { status: 401 }
      );
    }

    // 요청 검증
    const body = await request.json();
    const parseResult = MfaSessionRequestSchema.safeParse(body);

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

    const { tokenCode } = parseResult.data;

    // 장기 자격증명 조회
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

    // MFA Serial 조회
    const mfaSerial = getMfaSerial(session.userId);
    if (!mfaSerial) {
      return NextResponse.json(
        {
          error: {
            code: "MFA_NOT_CONFIGURED",
            message: "MFA가 설정되어 있지 않습니다. Settings에서 MFA ARN을 등록하세요.",
          },
        },
        { status: 400 }
      );
    }

    // STS GetSessionToken 호출
    const tempCreds = await getMfaSession({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
      mfaSerial,
      tokenCode,
    });

    // 임시 자격증명 저장
    saveTempCredentials(
      session.userId,
      tempCreds.accessKeyId,
      tempCreds.secretAccessKey,
      tempCreds.sessionToken,
      tempCreds.expiration
    );

    return NextResponse.json({
      success: true,
      expiresAt: tempCreds.expiration.toISOString(),
    });
  } catch (error) {
    console.error("MFA session error:", error);

    // STS 에러 매핑
    const mapped = mapAwsErrorToApiError(error, {
      source: "sts",
      usingTempCredentials: false,
    });

    if (mapped) {
      return NextResponse.json(
        { error: { code: mapped.code, message: mapped.message } },
        { status: mapped.httpStatus }
      );
    }

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
