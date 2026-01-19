/**
 * AWS STS 연동 - MFA 인증 후 임시 자격증명 발급
 */

import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts";

interface GetMfaSessionParams {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  mfaSerial: string;
  tokenCode: string;
  durationSeconds?: number; // 기본 43200 (12시간)
}

export interface MfaSessionResult {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

/**
 * MFA OTP로 임시 자격증명 발급
 * @throws STS 에러 (INVALID_MFA_TOKEN, STS_ERROR 등으로 변환 필요)
 */
export async function getMfaSession(
  params: GetMfaSessionParams
): Promise<MfaSessionResult> {
  const client = new STSClient({
    region: params.region,
    credentials: {
      accessKeyId: params.accessKeyId,
      secretAccessKey: params.secretAccessKey,
    },
  });

  const command = new GetSessionTokenCommand({
    SerialNumber: params.mfaSerial,
    TokenCode: params.tokenCode,
    DurationSeconds: params.durationSeconds ?? 43200, // 12시간
  });

  const response = await client.send(command);

  if (!response.Credentials) {
    throw new Error("STS response missing credentials");
  }

  const creds = response.Credentials;

  if (
    !creds.AccessKeyId ||
    !creds.SecretAccessKey ||
    !creds.SessionToken ||
    !creds.Expiration
  ) {
    throw new Error("STS response missing required credential fields");
  }

  return {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration,
  };
}
