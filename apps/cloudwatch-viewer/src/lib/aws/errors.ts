/**
 * AWS SDK 에러 → API 에러 매핑
 * route에서 직접 구현하지 않고 순수 함수로 분리하여 테스트 용이하게
 */

export type AwsErrorSource = "cloudwatch" | "sts";

export interface AwsErrorContext {
  source: AwsErrorSource;
  /** CloudWatch 호출 시 temp creds를 사용했는지 */
  usingTempCredentials: boolean;
}

export interface MappedApiError {
  httpStatus: 400 | 401 | 502;
  code:
    | "MFA_SESSION_EXPIRED"
    | "INVALID_MFA_TOKEN"
    | "STS_ERROR";
  message: string;
}

/**
 * AWS SDK 에러를 API 에러로 매핑
 * 매핑 불가능하면 null 반환 (원래 에러 그대로 처리)
 */
export function mapAwsErrorToApiError(
  err: unknown,
  ctx: AwsErrorContext
): MappedApiError | null {
  if (!isAwsSdkError(err)) {
    return null;
  }

  const { name, message } = err;

  // CloudWatch 호출 에러 (임시 자격증명 사용 시에만 MFA 관련으로 매핑)
  if (ctx.source === "cloudwatch" && ctx.usingTempCredentials) {
    // 만료된 세션 토큰
    if (name === "ExpiredToken" || name === "ExpiredTokenException") {
      return {
        httpStatus: 401,
        code: "MFA_SESSION_EXPIRED",
        message: "MFA 세션이 만료되었습니다. 다시 인증해주세요.",
      };
    }

    // 토큰 무효/폐기
    if (name === "InvalidClientTokenId" || name === "UnrecognizedClientException") {
      return {
        httpStatus: 401,
        code: "MFA_SESSION_EXPIRED",
        message: "MFA 세션이 유효하지 않습니다. 다시 인증해주세요.",
      };
    }

    // AccessDenied는 매핑하지 않음 (권한 문제일 수 있음)
  }

  // STS GetSessionToken 에러
  if (ctx.source === "sts") {
    // MFA 토큰 오류
    if (
      (name === "AccessDenied" || name === "AccessDeniedException") &&
      (message?.includes("MultiFactorAuthentication") ||
        message?.includes("MFA") ||
        message?.includes("mfa"))
    ) {
      return {
        httpStatus: 400,
        code: "INVALID_MFA_TOKEN",
        message: "MFA 코드가 올바르지 않습니다. 다시 확인해주세요.",
      };
    }

    // 그 외 STS 에러
    return {
      httpStatus: 502,
      code: "STS_ERROR",
      message: `AWS STS 오류: ${message || name}`,
    };
  }

  return null;
}

/**
 * AWS SDK 에러인지 확인
 */
function isAwsSdkError(err: unknown): err is { name: string; message?: string; $metadata?: { httpStatusCode?: number } } {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    typeof (err as { name: unknown }).name === "string"
  );
}

/**
 * MFA 관련 에러인지 확인 (클라이언트 측에서 사용)
 */
export function isMfaError(errorCode: string | undefined): boolean {
  return errorCode === "MFA_REQUIRED" || errorCode === "MFA_SESSION_EXPIRED";
}
