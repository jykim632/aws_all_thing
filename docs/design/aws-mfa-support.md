# AWS MFA 인증 지원 설계 문서

## 브랜치
```bash
git checkout -b feature/aws-mfa
```

---

## 1. 개요

### 1.1 문제
- MFA가 활성화된 AWS 계정은 Access Key + Secret Key만으로 API 호출 불가
- `AccessDenied` 에러 발생

### 1.2 해결책
- AWS STS `GetSessionToken` API로 MFA 인증 후 임시 자격증명 발급
- 임시 자격증명(Access Key, Secret Key, Session Token)으로 CloudWatch API 호출

### 1.3 핵심 흐름
```
[사용자]
    │
    ▼
[Settings] ─── MFA Serial ARN 등록 (한번만)
    │
    ▼
[로그 조회 요청]
    │
    ├─ MFA 미사용 → 바로 조회
    │
    └─ MFA 사용
       ├─ 유효한 임시자격증명 있음 → 바로 조회
       └─ 없거나 만료됨
          │
          ▼
       [MFA 모달] ─── OTP 6자리 입력
          │
          ▼
       [STS GetSessionToken] ─── 임시 자격증명 발급 (12시간)
          │
          ▼
       [DB 저장] ─── 암호화하여 저장
          │
          ▼
       [로그 조회]
```

---

## 2. DB 스키마 변경

### 2.1 현재 스키마
```sql
CREATE TABLE aws_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  access_key_id_encrypted TEXT NOT NULL,      -- 장기 자격증명
  secret_access_key_encrypted TEXT NOT NULL,  -- 장기 자격증명
  region TEXT DEFAULT 'ap-northeast-2',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2.2 추가할 칼럼
```sql
-- MFA 설정 (선택적)
mfa_serial_encrypted TEXT,          -- arn:aws:iam::123456789012:mfa/username

-- 임시 자격증명 (MFA 인증 후 발급)
temp_access_key_id_encrypted TEXT,
temp_secret_access_key_encrypted TEXT,
temp_session_token_encrypted TEXT,
temp_expires_at TEXT                -- ISO 8601: 2024-01-19T12:00:00Z
```

### 2.3 마이그레이션 전략
- `initSchema()` 함수에서 `ALTER TABLE ADD COLUMN` SQL 실행
- 모든 새 칼럼은 nullable → 기존 데이터 영향 없음
- `mfa_serial_encrypted`가 NULL이면 MFA 미사용으로 간주

---

## 3. API 설계

### 3.1 기존 API 수정

#### `GET /api/credentials`
**응답 변경:**
```typescript
interface CredentialsResponse {
  hasCredentials: boolean;
  accessKeyIdMasked: string | null;  // "AKIA****MPLE"
  region: string;
  // 추가
  mfaEnabled: boolean;
  mfaSerialMasked: string | null;    // "arn:aws:iam::****9012:mfa/user"
  tempCredentialsStatus: 'valid' | 'expired' | 'none';
  tempExpiresAt: string | null;      // ISO 8601
}
```

#### `POST /api/credentials`
**요청 변경:**
```typescript
interface SaveCredentialsRequest {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  // 추가
  mfaSerial?: string;  // MFA 사용 시
}
```

### 3.2 에러 응답 표준

모든 API 에러는 아래 포맷으로 통일한다.

```typescript
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

### 3.3 새 API

#### `POST /api/credentials/mfa-session`
OTP로 임시 자격증명 발급

**요청:**
```typescript
interface MfaSessionRequest {
  tokenCode: string; // 6자리 숫자
}
```

**성공 응답 (200):**
```typescript
interface MfaSessionResponse {
  success: true;
  expiresAt: string; // ISO 8601
}
```

**에러 응답:**
```typescript
// 400 Bad Request
// - MFA_NOT_CONFIGURED: 서버에 mfaSerial이 저장되어 있지 않음
// - INVALID_MFA_TOKEN: OTP가 틀림
//
// 502 Bad Gateway
// - STS_ERROR: STS 호출 실패 (그 외)
{
  error: {
    code: 'MFA_NOT_CONFIGURED' | 'INVALID_MFA_TOKEN' | 'STS_ERROR';
    message: string;
  }
}
```

### 3.4 로그 API 에러 응답 추가

#### `GET /api/logs/groups`, `GET /api/logs/events`

```typescript
// 401 Unauthorized
// - MFA_REQUIRED: MFA 설정 계정인데 유효한 임시 자격증명이 없음
// - MFA_SESSION_EXPIRED: 임시 자격증명이 만료/무효
{
  error: {
    code: 'MFA_REQUIRED' | 'MFA_SESSION_EXPIRED';
    message: string;
  }
}
```

---

## 4. 타입 정의

### 4.1 packages/db/src/types.ts 확장
```typescript
export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  // 추가
  sessionToken?: string;  // 임시 자격증명용
}

export interface AwsCredentialsWithMfa extends AwsCredentials {
  mfaSerial?: string;
  tempExpiresAt?: Date;
}
```

### 4.2 apps/cloudwatch-viewer/src/types/index.ts 확장
```typescript
// 요청 스키마
export const SaveCredentialsRequestSchema = z.object({
  accessKeyId: z.string().min(16),
  secretAccessKey: z.string().min(1),
  region: z.string().optional(),
  mfaSerial: z.string().regex(/^arn:aws:iam::\d{12}:mfa\/.+$/).optional(),
});

export const MfaSessionRequestSchema = z.object({
  tokenCode: z.string().regex(/^\d{6}$/),
});
```

---

## 5. 구현 상세

### 5.0 MFA 필요 판별 규칙 (서버)

`GET /api/logs/*`에서 MFA 관련 에러는 "AWS 응답을 보고 추측"하기보다, 서버가 다음 규칙으로 선제적으로 결정한다.

- `mfa_serial_encrypted`가 NULL이면 MFA 미사용 계정으로 간주하고, 기존처럼 장기 자격증명으로만 호출한다.
- `mfa_serial_encrypted`가 설정되어 있고 `getValidTempCredentials(userId)`가 NULL이면 AWS 호출 전에 `401` + `MFA_REQUIRED`를 반환한다.
- 임시 자격증명을 사용해 AWS 호출을 시도했는데, 토큰 만료/무효로 판단되는 에러가 발생하면 `401` + `MFA_SESSION_EXPIRED`를 반환한다.
- 그 외 `AccessDenied` 류는 MFA로 단정하지 말고 "권한 문제"로 그대로 반환한다 (MFA 안내로 오인 방지).

#### AWS SDK 에러 → API 에러 매핑 (권장)

아래 매핑은 "임시 자격증명을 사용해서 AWS를 호출했을 때"에만 적용한다. (장기 자격증명 오류를 MFA 만료로 오인하지 않기 위함)

| 호출 컨텍스트 | 감지 기준 (우선순위) | 반환 code | 비고 |
|---|---|---|---|
| CloudWatch Logs 호출 (temp creds) | `err.name`가 `ExpiredToken` 또는 `ExpiredTokenException` | `MFA_SESSION_EXPIRED` | 만료된 세션 토큰 |
| CloudWatch Logs 호출 (temp creds) | `err.name`가 `InvalidClientTokenId` 또는 `UnrecognizedClientException` | `MFA_SESSION_EXPIRED` | 토큰 무효/폐기 |
| CloudWatch Logs 호출 (temp creds) | `err.$metadata?.httpStatusCode === 403` 이면서 `err.name`가 `AccessDenied`/`AccessDeniedException` | (매핑하지 않음) | 권한 부족일 가능성이 높음 |
| STS `GetSessionToken` 호출 | `err.name`가 `AccessDenied`/`AccessDeniedException` 이고 message에 `MultiFactorAuthentication` 또는 `MFA` 관련 문구 포함 | `INVALID_MFA_TOKEN` | OTP 틀림/만료 |
| STS `GetSessionToken` 호출 | 그 외 모든 에러 | `STS_ERROR` | upstream 장애/설정 문제 |

#### 권장 헬퍼 함수 시그니처

에러 매핑 로직은 route에서 직접 구현하지 않고, 아래 순수 함수로 분리해 단위 테스트한다.

```typescript
export type AwsErrorSource = "cloudwatch" | "sts";

export interface AwsErrorContext {
  source: AwsErrorSource;
  // CloudWatch 호출 시 temp creds를 사용했는지
  usingTempCredentials: boolean;
}

export interface MappedApiError {
  httpStatus: 400 | 401 | 502;
  code:
    | "MFA_REQUIRED"
    | "MFA_SESSION_EXPIRED"
    | "MFA_NOT_CONFIGURED"
    | "INVALID_MFA_TOKEN"
    | "STS_ERROR";
  message: string;
}

export function mapAwsErrorToApiError(err: unknown, ctx: AwsErrorContext): MappedApiError | null;
```

route 사용 예:

```typescript
try {
  // call AWS...
} catch (err) {
  const mapped = mapAwsErrorToApiError(err, { source: "cloudwatch", usingTempCredentials: true });
  if (mapped) {
    return Response.json(
      { error: { code: mapped.code, message: mapped.message } },
      { status: mapped.httpStatus }
    );
  }
  throw err;
}
```


### 5.1 STS 연동 (새 파일: lib/aws/sts.ts)
```typescript
import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts";

interface GetMfaSessionParams {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  mfaSerial: string;
  tokenCode: string;
  durationSeconds?: number;  // 기본 43200 (12시간)
}

interface MfaSessionResult {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

export async function getMfaSession(params: GetMfaSessionParams): Promise<MfaSessionResult> {
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
    DurationSeconds: params.durationSeconds ?? 43200,
  });

  const response = await client.send(command);
  const creds = response.Credentials!;

  return {
    accessKeyId: creds.AccessKeyId!,
    secretAccessKey: creds.SecretAccessKey!,
    sessionToken: creds.SessionToken!,
    expiration: creds.Expiration!,
  };
}
```

### 5.2 CloudWatch 클라이언트 수정 (lib/aws/client.ts)
```typescript
export function getCloudWatchLogsClient(
  credentials: AwsCredentials
): CloudWatchLogsClient {
  // 캐시 키에 sessionToken 포함 (있으면)
  const cacheKey = credentials.sessionToken
    ? `${credentials.accessKeyId}:${credentials.region}:${credentials.sessionToken.slice(-8)}`
    : `${credentials.accessKeyId}:${credentials.region}`;

  // ...

  const client = new CloudWatchLogsClient({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,  // 추가
    },
  });

  // ...
}
```

### 5.3 DB CRUD 함수 추가 (packages/db/src/users.ts)
```typescript
// MFA Serial 저장
export function saveMfaSerial(userId: number, mfaSerial: string): void;

// MFA Serial 조회
export function getMfaSerial(userId: number): string | null;

// 임시 자격증명 저장
export function saveTempCredentials(
  userId: number,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  expiresAt: Date
): void;

// 임시 자격증명 조회 (만료 체크 포함)
export function getValidTempCredentials(userId: number): TempCredentials | null;

// 임시 자격증명 삭제
export function clearTempCredentials(userId: number): void;

// AWS credentials 조회 (임시 자격증명 우선 사용)
export function getEffectiveAwsCredentials(userId: number): AwsCredentials | null;
```

---

## 6. UI 설계

### 6.1 CredentialsForm 수정
```
┌─────────────────────────────────────────────────┐
│  AWS Credentials                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  Access Key ID                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ AKIAIOSFODNN7EXAMPLE                    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Secret Access Key                              │
│  ┌─────────────────────────────────────────┐   │
│  │ ••••••••••••••••••••••••                │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Region                                         │
│  ┌─────────────────────────────────────────┐   │
│  │ ap-northeast-2 (Seoul)              ▼   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ☑ MFA 사용 (선택)                              │
│  ┌─────────────────────────────────────────┐   │
│  │ arn:aws:iam::123456789012:mfa/username  │   │
│  └─────────────────────────────────────────┘   │
│  ℹ️ AWS Console > IAM > Users > Security       │
│     credentials > MFA devices에서 ARN 복사      │
│                                                 │
│  ┌──────────┐  ┌──────────┐                    │
│  │   Save   │  │  Delete  │                    │
│  └──────────┘  └──────────┘                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.2 MFA 모달 (새 컴포넌트)
```
┌─────────────────────────────────────────────────┐
│              MFA 인증 필요                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  AWS MFA 앱(Google Authenticator 등)에서        │
│  6자리 코드를 확인하세요.                        │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │            [  1  2  3  4  5  6  ]       │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ⏱️ 인증 후 12시간 동안 유효                     │
│                                                 │
│  ┌──────────┐              ┌──────────┐        │
│  │   취소   │              │   인증   │        │
│  └──────────┘              └──────────┘        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.3 에러 핸들링 흐름
```typescript
// 로그 조회 시
async function fetchLogs() {
  const res = await fetch('/api/logs/events?...');

  if (!res.ok) {
    const body = await res.json();

    if (
      body?.error?.code === 'MFA_REQUIRED' ||
      body?.error?.code === 'MFA_SESSION_EXPIRED'
    ) {
      setShowMfaModal(true);
      return;
    }

    // 다른 에러 처리
  }

  // 성공
}

// MFA 인증 후
async function handleMfaSubmit(tokenCode: string) {
  const res = await fetch('/api/credentials/mfa-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenCode }),
  });

  if (res.ok) {
    setShowMfaModal(false);
    fetchLogs(); // 재시도
  }
}
```

---

## 7. 파일 변경 목록

### 새로 생성
| 파일 | 설명 |
|------|------|
| `apps/cloudwatch-viewer/src/lib/aws/sts.ts` | STS GetSessionToken 연동 |
| `apps/cloudwatch-viewer/src/lib/aws/errors.ts` | AWS SDK 에러 → API 에러 매핑 |
| `apps/cloudwatch-viewer/src/app/api/credentials/mfa-session/route.ts` | MFA 세션 API |
| `apps/cloudwatch-viewer/src/components/MfaModal.tsx` | OTP 입력 모달 |

### 수정
| 파일 | 변경 내용 |
|------|----------|
| `packages/db/src/schema.ts` | 마이그레이션 SQL 추가 |
| `packages/db/src/types.ts` | 타입 확장 |
| `packages/db/src/users.ts` | MFA/임시자격증명 CRUD |
| `apps/cloudwatch-viewer/src/lib/aws/client.ts` | sessionToken 지원 |
| `apps/cloudwatch-viewer/src/types/index.ts` | Zod 스키마 확장 |
| `apps/cloudwatch-viewer/src/components/CredentialsForm.tsx` | MFA 필드 추가 |
| `apps/cloudwatch-viewer/src/app/api/credentials/route.ts` | MFA Serial 저장 |
| `apps/cloudwatch-viewer/src/app/api/logs/groups/route.ts` | MFA 체크 추가 |
| `apps/cloudwatch-viewer/src/app/api/logs/events/route.ts` | MFA 체크 추가 |
| `apps/cloudwatch-viewer/src/app/page.tsx` | MFA 모달 연동 |

---

## 8. 의존성

```bash
npm install @aws-sdk/client-sts
```

---

## 9. 테스트

### 9.1 수동 체크리스트

- [ ] MFA 미사용 계정: 기존과 동일하게 동작
- [ ] MFA Serial 저장/조회/마스킹 표시
- [ ] MFA 모달 표시 (임시 자격증명 없을 때)
- [ ] OTP 입력 → 임시 자격증명 발급 → DB 저장
- [ ] 임시 자격증명으로 CloudWatch API 호출 성공
- [ ] 만료 전 재사용 (OTP 재입력 불필요)
- [ ] 만료 후 MFA 모달 다시 표시
- [ ] 잘못된 OTP 에러 메시지

### 9.2 테스트 코드 구현 계획

현재 `packages/db`는 `vitest`가 이미 있으므로, 우선 DB/암호화/만료 로직을 테스트로 고정하고 API/Next route는 "순수 함수로 분리"해서 단위 테스트 가능하게 만든다.

#### 이번 스코프 (Option B) / Out of scope

- 포함: `packages/db` 단위 테스트 + 에러 매핑 순수 함수 단위 테스트
- 제외: Next route 통합 테스트, UI(E2E) 테스트

- `packages/db`
  - `packages/db/src/users.mfa.test.ts` (신규)
    - `saveMfaSerial`/`getMfaSerial` 저장·조회
    - `saveTempCredentials`/`getValidTempCredentials` 만료 전/후 동작 (현재 시간 고정)
    - `clearTempCredentials` 정리 동작
    - `getEffectiveAwsCredentials`가 "유효한 temp creds 우선"을 보장
  - `packages/db/src/schema.mfa-migration.test.ts` (신규)
    - `initSchema()` 이후 새 컬럼들이 존재하는지 확인 (`PRAGMA table_info(aws_credentials)` 기반)

- `apps/cloudwatch-viewer`
  - 에러 매핑 로직을 `apps/cloudwatch-viewer/src/lib/aws/errors.ts` 같은 순수 함수로 분리 후 테스트
    - 입력: AWS SDK error shape (`name`, `message`, `$metadata.httpStatusCode`)
    - 출력: `{ code, httpStatus, message }` (or `null`)
  - Next route 핸들러는 "분리된 로직"을 호출만 하게 유지하고, route 자체의 테스트는 후순위(필요 시 추가)

---

## 10. 보안 고려사항

- MFA Serial, 임시 자격증명 모두 AES-256-GCM 암호화
- OTP 코드는 로깅/저장 금지
- 임시 자격증명 유효기간: 12시간 (43200초)
- 클라이언트 캐시 키에 sessionToken 일부 포함 (토큰 변경 시 새 클라이언트 생성)
