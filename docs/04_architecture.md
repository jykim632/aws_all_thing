# 아키텍처

## 1단계 아키텍처 (MVP)

```
┌─────────────────────────────────────────────────────────┐
│                      사용자 브라우저                      │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Next.js 서버                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Pages     │  │ API Routes  │  │  서버 캐시       │  │
│  │  (React)    │  │ /api/logs/* │  │  (5초 TTL)      │  │
│  └─────────────┘  └──────┬──────┘  └────────┬────────┘  │
│                          │                   │           │
│                          └───────┬───────────┘           │
│                                  │                       │
│                          ┌───────▼───────┐               │
│                          │  AWS SDK v3   │               │
│                          │  Client       │               │
│                          └───────┬───────┘               │
└──────────────────────────────────┼───────────────────────┘
                                   │ HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────┐
│                 AWS CloudWatch Logs                      │
│                  (내 계정, ap-northeast-2)               │
└─────────────────────────────────────────────────────────┘
```

---

## 디렉토리 구조 (예상)

```
aws/
├── docs/                    # 문서
│   ├── 01_project_overview.md
│   ├── 02_technical_decisions.md
│   ├── 03_aws_concepts.md
│   └── 04_architecture.md
│
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── page.tsx         # 메인 페이지
│   │   ├── layout.tsx
│   │   └── api/
│   │       └── logs/
│   │           ├── groups/route.ts    # GET /api/logs/groups
│   │           └── events/route.ts    # GET /api/logs/events
│   │
│   ├── lib/
│   │   ├── aws/
│   │   │   ├── client.ts              # CloudWatch 클라이언트
│   │   │   └── logs.ts                # 로그 조회 함수들
│   │   └── cache.ts                   # 캐시 유틸
│   │
│   └── components/
│       ├── LogGroupList.tsx
│       ├── LogViewer.tsx
│       └── TimeRangeSelector.tsx
│
├── .env.local               # AWS credentials (gitignore)
├── package.json
└── next.config.js
```

---

## API 설계

### GET /api/logs/groups

로그 그룹 목록 조회

**Request:**
```
GET /api/logs/groups?prefix=/aws/lambda/
```

**Response:**
```json
{
  "logGroups": [
    {
      "logGroupName": "/aws/lambda/my-function",
      "storedBytes": 1234567,
      "creationTime": 1705123456789
    }
  ]
}
```

---

### GET /api/logs/events

로그 이벤트 조회

**Request:**
```
GET /api/logs/events
  ?logGroupName=/aws/lambda/my-function
  &startTime=1705123456789
  &endTime=1705127056789
  &filterPattern=ERROR
  &limit=100
```

**Response:**
```json
{
  "events": [
    {
      "timestamp": 1705123456789,
      "message": "[ERROR] Something went wrong",
      "logStreamName": "2024/01/13/[$LATEST]abc123"
    }
  ],
  "nextToken": "..."
}
```

---

## 캐싱 전략

### 왜 캐싱?
- Rate Limit 대응 (5회/초)
- 비용 절감 (API 호출 감소)
- 응답 속도 향상

### 캐시 키 설계

```typescript
// 로그 그룹 목록
`log-groups:${prefix || 'all'}`

// 로그 이벤트
`log-events:${logGroupName}:${startTime}:${endTime}:${filterPattern}`
```

### TTL

| 데이터 | TTL | 이유 |
|--------|-----|------|
| 로그 그룹 목록 | 60초 | 자주 안 바뀜 |
| 로그 이벤트 | 5초 | 실시간성 필요 |

### 구현 (간단한 메모리 캐시)

```typescript
const cache = new Map<string, { data: any; expireAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any, ttlMs: number): void {
  cache.set(key, { data, expireAt: Date.now() + ttlMs });
}
```

---

## 2단계 아키텍처 (크로스 계정)

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 서버                          │
│                                                          │
│  ┌──────────────────┐     ┌──────────────────────────┐  │
│  │ 계정 설정 관리    │     │ STS Client               │  │
│  │ (config.json)    │     │ AssumeRole               │  │
│  └────────┬─────────┘     └────────────┬─────────────┘  │
│           │                            │                 │
│           ▼                            ▼                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │              CloudWatch Client Pool              │   │
│  │  (계정별 임시 credentials 캐싱)                   │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     ┌─────────┐     ┌─────────┐     ┌─────────┐
     │ 계정 A  │     │ 계정 B  │     │ 계정 C  │
     │ Role    │     │ Role    │     │ Role    │
     └─────────┘     └─────────┘     └─────────┘
```

---

## 환경변수

### .env.local (1단계)

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-northeast-2

# 캐시 설정
CACHE_TTL_LOG_GROUPS=60000
CACHE_TTL_LOG_EVENTS=5000
```

### 계정 설정 (2단계)

```json
// config/accounts.json
{
  "accounts": [
    {
      "name": "Production A",
      "accountId": "111111111111",
      "roleArn": "arn:aws:iam::111111111111:role/CloudWatchLogReader",
      "region": "ap-northeast-2"
    },
    {
      "name": "Development",
      "accountId": "222222222222",
      "roleArn": "arn:aws:iam::222222222222:role/CloudWatchLogReader",
      "region": "ap-northeast-2"
    }
  ]
}
```

---

## 에러 처리

### AWS API 에러

| 에러 | 원인 | 대응 |
|------|------|------|
| ThrottlingException | Rate limit 초과 | 캐시 확인, 재시도 |
| AccessDeniedException | 권한 없음 | 403 반환, 로그 |
| ResourceNotFoundException | 로그 그룹 없음 | 404 반환 |
| ExpiredTokenException | 임시 토큰 만료 | 재발급 후 재시도 |

### 에러 응답 형식

```json
{
  "error": {
    "code": "THROTTLING",
    "message": "Rate limit exceeded. Please try again.",
    "retryAfter": 1000
  }
}
```

---

## 1단계 구현 체크리스트

- [ ] Next.js 프로젝트 초기화
- [ ] AWS SDK 설치 및 클라이언트 설정
- [ ] /api/logs/groups 엔드포인트
- [ ] /api/logs/events 엔드포인트
- [ ] 메모리 캐시 구현
- [ ] 로그 그룹 목록 UI
- [ ] 로그 뷰어 UI
- [ ] 시간 범위 선택
- [ ] 키워드 필터
