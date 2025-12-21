/**
 * AWS CloudWatch Logs 클라이언트 (싱글톤)
 */

import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";

let client: CloudWatchLogsClient | null = null;

/**
 * CloudWatch Logs 클라이언트 반환
 * 환경변수에서 credentials 로드
 */
export function getCloudWatchLogsClient(): CloudWatchLogsClient {
  if (client) {
    return client;
  }

  // 환경변수 검증
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "ap-northeast-2";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local"
    );
  }

  client = new CloudWatchLogsClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return client;
}

/**
 * 클라이언트 리셋 (테스트용)
 */
export function resetClient(): void {
  client = null;
}
