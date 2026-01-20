/**
 * /api/credentials
 * GET: 현재 credentials 상태 조회 (마스킹)
 * POST: credentials 저장/업데이트
 * DELETE: credentials 삭제
 */

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/init";
import {
  getAwsCredentials,
  saveAwsCredentials,
  deleteAwsCredentials,
  getMaskedAccessKeyId,
  saveMfaSerial,
  getMaskedMfaSerial,
  getMfaStatus,
  clearTempCredentials,
} from "@aws-internal/db";
import type { SessionData } from "@aws-internal/auth";
import { CredentialsRequestSchema, CredentialsPatchSchema } from "@/types";

/**
 * GET: credentials 존재 여부 및 마스킹된 Access Key 조회
 */
export async function GET() {
  try {
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

    const creds = getAwsCredentials(session.userId);

    if (!creds) {
      return NextResponse.json({
        hasCredentials: false,
        accessKeyIdMasked: null,
        region: "ap-northeast-2",
        mfaEnabled: false,
        mfaSerialMasked: null,
        tempCredentialsStatus: "none" as const,
        tempExpiresAt: null,
      });
    }

    const mfaStatus = getMfaStatus(session.userId);

    return NextResponse.json({
      hasCredentials: true,
      accessKeyIdMasked: getMaskedAccessKeyId(session.userId),
      region: creds.region,
      mfaEnabled: mfaStatus.mfaEnabled,
      mfaSerialMasked: getMaskedMfaSerial(session.userId),
      tempCredentialsStatus: mfaStatus.tempCredentialsStatus,
      tempExpiresAt: mfaStatus.tempExpiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Get credentials error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

/**
 * POST: credentials 저장/업데이트
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json();

    // 요청 검증
    const parseResult = CredentialsRequestSchema.safeParse(body);
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

    const { accessKeyId, secretAccessKey, region, mfaSerial } = parseResult.data;

    saveAwsCredentials(
      session.userId,
      accessKeyId,
      secretAccessKey,
      region || "ap-northeast-2"
    );

    // MFA Serial 저장 (없으면 null로 설정하여 MFA 비활성화)
    saveMfaSerial(session.userId, mfaSerial ?? null);

    // MFA 설정이 변경되면 기존 임시 자격증명 삭제
    clearTempCredentials(session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save credentials error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE: credentials 삭제
 */
export async function DELETE() {
  try {
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

    deleteAwsCredentials(session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete credentials error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH: 필드별 부분 업데이트
 * - accessKeyId + secretAccessKey: 쌍으로만 변경 가능
 * - region: 단독 변경 가능
 * - mfaSerial: 단독 변경 가능 (null이면 MFA 삭제)
 */
export async function PATCH(request: Request) {
  try {
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

    // 기존 credentials 확인
    const existingCreds = getAwsCredentials(session.userId);
    if (!existingCreds) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No credentials found. Use POST to create." } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 요청 검증
    const parseResult = CredentialsPatchSchema.safeParse(body);
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

    const { accessKeyId, secretAccessKey, region, mfaSerial } = parseResult.data;

    // Access Key 쌍 업데이트
    if (accessKeyId && secretAccessKey) {
      saveAwsCredentials(
        session.userId,
        accessKeyId,
        secretAccessKey,
        region ?? existingCreds.region
      );
    }
    // Region만 업데이트
    else if (region !== undefined) {
      saveAwsCredentials(
        session.userId,
        existingCreds.accessKeyId,
        existingCreds.secretAccessKey,
        region
      );
    }

    // MFA Serial 업데이트 (null이면 삭제)
    if (mfaSerial !== undefined) {
      saveMfaSerial(session.userId, mfaSerial);
      // MFA 설정 변경 시 임시 자격증명 삭제
      clearTempCredentials(session.userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Patch credentials error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
