/**
 * API 응답 공통 처리 함수
 */

import { ApiErrorResponseSchema, UiError } from "@/types";

/**
 * API 응답에서 에러 추출
 * Zod로 안전하게 파싱하여 UiError 반환, 에러가 없으면 null
 */
export function extractApiError(data: unknown): UiError | null {
  const result = ApiErrorResponseSchema.safeParse(data);
  if (result.success) {
    return {
      code: result.data.error.code,
      message: result.data.error.message,
    };
  }
  return null;
}
