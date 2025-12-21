# AWS 개념 학습 가이드

이 프로젝트를 통해 배울 수 있는 AWS 개념들을 정리한다.

---

## 1. AWS SDK v3 사용법

### SDK v2 vs v3

| 항목 | v2 (레거시) | v3 (현재) |
|------|-------------|-----------|
| 패키지 | `aws-sdk` (전체) | `@aws-sdk/client-xxx` (개별) |
| 번들 크기 | 크다 | 필요한 것만 |
| 문법 | callback / promise | async/await 기본 |

### 설치

```bash
# 필요한 패키지만 설치
npm install @aws-sdk/client-cloudwatch-logs
npm install @aws-sdk/client-sts  # 나중에 Role Assume 시
```

### 기본 사용법

```typescript
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand
} from "@aws-sdk/client-cloudwatch-logs";

// 클라이언트 생성
const client = new CloudWatchLogsClient({
  region: "ap-northeast-2",  // 서울 리전
  // credentials는 환경변수에서 자동으로 읽음
});

// 명령 실행
const response = await client.send(new DescribeLogGroupsCommand({}));
```

### Credentials 설정 방법

**방법 1: 환경변수 (개발용)**
```bash
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_REGION=ap-northeast-2
```

**방법 2: ~/.aws/credentials 파일**
```ini
[default]
aws_access_key_id = xxx
aws_secret_access_key = xxx
```

**방법 3: 코드에서 직접 (비추천)**
```typescript
const client = new CloudWatchLogsClient({
  credentials: {
    accessKeyId: "xxx",
    secretAccessKey: "xxx"
  }
});
```

SDK는 자동으로 이 순서로 credentials를 찾는다:
1. 코드에서 직접 전달
2. 환경변수
3. ~/.aws/credentials 파일
4. EC2/ECS/Lambda의 IAM Role

---

## 2. CloudWatch Logs API 구조

### 핵심 개념

```
CloudWatch Logs
├── Log Group (로그 그룹)
│   ├── /aws/lambda/my-function
│   ├── /aws/apigateway/my-api
│   └── /ecs/my-service
│
└── Log Stream (로그 스트림) - 로그 그룹 안에 있음
    ├── 2024/01/15/[$LATEST]abc123
    ├── 2024/01/15/[$LATEST]def456
    └── ...
```

- **Log Group**: 로그의 논리적 그룹 (보통 서비스 단위)
- **Log Stream**: 실제 로그가 쌓이는 곳 (인스턴스/호출 단위)

### 주요 API

**1. DescribeLogGroups - 로그 그룹 목록**
```typescript
const command = new DescribeLogGroupsCommand({
  logGroupNamePrefix: "/aws/lambda/",  // 선택: 접두사 필터
  limit: 50  // 최대 50개
});
```

**2. DescribeLogStreams - 로그 스트림 목록**
```typescript
const command = new DescribeLogStreamsCommand({
  logGroupName: "/aws/lambda/my-function",
  orderBy: "LastEventTime",
  descending: true,
  limit: 10
});
```

**3. FilterLogEvents - 로그 조회 (추천)**
```typescript
const command = new FilterLogEventsCommand({
  logGroupName: "/aws/lambda/my-function",
  startTime: Date.now() - 3600000,  // 1시간 전 (밀리초)
  endTime: Date.now(),
  filterPattern: "ERROR",  // 선택: 키워드 필터
  limit: 100
});
```

**4. GetLogEvents - 특정 스트림에서 조회**
```typescript
const command = new GetLogEventsCommand({
  logGroupName: "/aws/lambda/my-function",
  logStreamName: "2024/01/15/[$LATEST]abc123",
  startTime: Date.now() - 3600000,
  limit: 100
});
```

### FilterLogEvents vs GetLogEvents

| 항목 | FilterLogEvents | GetLogEvents |
|------|-----------------|--------------|
| 범위 | 로그 그룹 전체 | 특정 스트림만 |
| 필터링 | 키워드 검색 가능 | 불가 |
| 용도 | 일반적인 로그 조회 | 특정 스트림 상세 조회 |

### 페이지네이션

```typescript
let nextToken: string | undefined;

do {
  const response = await client.send(new FilterLogEventsCommand({
    logGroupName: "/aws/lambda/my-function",
    nextToken,  // 이전 응답의 nextToken
    limit: 100
  }));

  // 로그 처리
  console.log(response.events);

  nextToken = response.nextToken;
} while (nextToken);
```

---

## 3. IAM Credentials 관리

### IAM 기본 개념

```
AWS 계정
├── IAM User (사람용)
│   └── Access Key (프로그래밍 접근용)
│
├── IAM Role (서비스/임시 접근용)
│   └── 신뢰 정책 (누가 이 Role을 쓸 수 있나)
│
└── IAM Policy (권한 정의)
    └── 어떤 서비스의 어떤 작업을 허용/거부
```

### 최소 권한 원칙

이 프로젝트에 필요한 권한만:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "logs:GetLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### Access Key 보안

**하지 말 것:**
- 코드에 하드코딩
- Git에 커밋
- 공유

**해야 할 것:**
- 환경변수 또는 AWS credentials 파일 사용
- 주기적 로테이션
- 필요 없으면 삭제

---

## 4. STS AssumeRole (2단계에서)

### 개념

내 계정에서 다른 계정의 리소스에 접근하기 위해 임시 credentials를 발급받는 것.

```
내 계정 (서비스 호스팅)
    │
    │ AssumeRole 요청
    ▼
STS (Security Token Service)
    │
    │ 임시 credentials 발급 (1시간 유효)
    ▼
타겟 계정의 CloudWatch Logs 접근
```

### 코드 예시

```typescript
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";

// 1. STS로 임시 credentials 획득
const stsClient = new STSClient({ region: "ap-northeast-2" });
const assumeRoleResponse = await stsClient.send(new AssumeRoleCommand({
  RoleArn: "arn:aws:iam::123456789012:role/CloudWatchLogReader",
  RoleSessionName: "log-viewer-session"
}));

const { Credentials } = assumeRoleResponse;

// 2. 임시 credentials로 CloudWatch 클라이언트 생성
const cwClient = new CloudWatchLogsClient({
  region: "ap-northeast-2",
  credentials: {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretAccessKey,
    sessionToken: Credentials.SessionToken
  }
});

// 3. 타겟 계정의 로그 조회
const logs = await cwClient.send(new DescribeLogGroupsCommand({}));
```

### 타겟 계정에 필요한 Role 설정

**Trust Policy (누가 이 Role을 assume할 수 있나):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::내계정ID:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Permission Policy (이 Role로 무엇을 할 수 있나):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "logs:GetLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 5. 크로스 계정 접근 전체 흐름

```
[1단계 - 설정]
타겟 계정 A: Role 생성 (CloudWatchLogReader)
            - Trust: 내 계정 허용
            - Permission: CloudWatch 읽기

타겟 계정 B: Role 생성 (동일)
...

[2단계 - 런타임]
1. 사용자가 "계정 A 로그 보기" 선택
2. 백엔드가 계정 A의 Role ARN 조회
3. STS AssumeRole 호출 → 임시 credentials
4. 임시 credentials로 CloudWatch API 호출
5. 결과 캐싱
6. 사용자에게 반환
```

---

## 학습 순서 권장

| 순서 | 개념 | 이 프로젝트에서 |
|------|------|-----------------|
| 1 | AWS SDK v3 기본 | 클라이언트 생성, 명령 실행 |
| 2 | CloudWatch Logs API | 로그 그룹/이벤트 조회 |
| 3 | IAM credentials | 환경변수 설정, 권한 이해 |
| 4 | 페이지네이션 | nextToken 처리 |
| 5 | STS AssumeRole | 2단계에서 크로스 계정 |

---

## 참고 문서

- [AWS SDK v3 for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [CloudWatch Logs API Reference](https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [STS AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
