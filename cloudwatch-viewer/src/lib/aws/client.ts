/**
 * AWS CloudWatch Logs 클라이언트
 * 사용자별 credentials를 받아서 클라이언트 생성
 */

import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import type { AwsCredentials } from "@/types";

// 클라이언트 캐시 (accessKeyId:region -> client)
const clientCache = new Map<string, CloudWatchLogsClient>();

/**
 * 사용자 credentials로 CloudWatch Logs 클라이언트 반환
 * 동일 credentials는 캐시에서 재사용
 */
export function getCloudWatchLogsClient(
  credentials: AwsCredentials
): CloudWatchLogsClient {
  const cacheKey = `${credentials.accessKeyId}:${credentials.region}`;

  const cached = clientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = new CloudWatchLogsClient({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  clientCache.set(cacheKey, client);

  // 캐시 크기 제한 (간단한 LRU 대안)
  if (clientCache.size > 100) {
    const firstKey = clientCache.keys().next().value;
    if (firstKey) {
      clientCache.delete(firstKey);
    }
  }

  return client;
}

/**
 * 환경변수에서 credentials 로드하여 클라이언트 반환
 * 하위 호환성 및 관리자용
 */
export function getCloudWatchLogsClientFromEnv(): CloudWatchLogsClient {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "ap-northeast-2";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local"
    );
  }

  return getCloudWatchLogsClient({ accessKeyId, secretAccessKey, region });
}

/**
 * 클라이언트 캐시 초기화 (테스트용)
 */
export function resetClientCache(): void {
  clientCache.clear();
}
