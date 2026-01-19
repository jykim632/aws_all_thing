# 2026-01-20 AWS MFA 인증 지원

## 작업 내용

MFA가 활성화된 AWS 계정에서도 CloudWatch 로그를 조회할 수 있도록 MFA 인증 기능 구현.

### 구현한 것
- Settings에서 MFA Serial ARN 등록 (선택)
- 로그 조회 시 MFA 필요하면 OTP 입력 모달 표시
- STS GetSessionToken으로 임시 자격증명 발급 (12시간)
- 임시 자격증명 DB 암호화 저장
- AWS SDK 에러 → API 에러 매핑 로직

### 변경 파일
- `packages/db`: 스키마 마이그레이션, MFA/임시자격증명 CRUD
- `apps/cloudwatch-viewer`: STS 연동, 에러 매핑, API 수정, UI 컴포넌트

---

## 왜 했는지 (맥락)

- 회사에서 AWS 계정에 MFA 필수 정책 적용됨
- 기존에는 Access Key + Secret Key만으로 동작했는데, MFA 활성화 계정은 `AccessDenied` 에러 발생
- 사용자가 OTP 한번 입력하면 12시간 동안 재인증 없이 사용 가능하도록 설계

---

## 논의/아이디어/고민

### 에러 판별 전략
- 처음엔 "AWS 에러 메시지로 MFA 필요 여부 추측" 생각했음
- 근데 `AccessDenied`가 권한 문제인지 MFA 문제인지 구분 어려움
- **결론**: 서버가 선제적으로 판단
  - `mfa_serial` 있는데 유효한 temp creds 없으면 → `MFA_REQUIRED` 반환
  - AWS 호출 전에 체크하니까 오탐 없음

### 에러 매핑 분리
- route에서 직접 에러 처리하면 코드 중복 + 테스트 어려움
- `mapAwsErrorToApiError()` 순수 함수로 분리
- 나중에 단위 테스트 추가 가능

### 임시 자격증명 만료 체크
- 정확한 만료 시간 - 5분 마진
- DB에서 조회할 때 만료 체크해서 null 반환
- 만료된 건 `MFA_SESSION_EXPIRED`로 구분

---

## 결정된 내용

| 항목 | 결정 |
|------|------|
| 임시 자격증명 유효기간 | 12시간 (AWS 최대) |
| 만료 마진 | 5분 전부터 무효 처리 |
| MFA 미설정 계정 | 기존처럼 장기 자격증명 사용 |
| 에러 코드 | `MFA_REQUIRED`, `MFA_SESSION_EXPIRED`, `INVALID_MFA_TOKEN`, `STS_ERROR` |

---

## 느낀 점/난이도/발견

- **난이도**: 중간. 설계 문서가 상세해서 구현은 순조로웠음
- **발견**: AWS SDK v3는 `sessionToken`만 credentials에 추가하면 바로 동작함
- CloudWatch 클라이언트 캐시 키에 sessionToken 일부 포함해야 토큰 변경 시 새 클라이언트 생성됨

---

## 남은 것/미정

- [ ] 실제 MFA 계정으로 E2E 테스트
- [ ] `mapAwsErrorToApiError()` 단위 테스트
- [ ] DB 마이그레이션 테스트 (`PRAGMA table_info` 확인)
- [ ] MFA 세션 만료 시 자동 갱신 (현재는 수동 재인증)

---

## 다음 액션

1. develop에 머지 전 실제 MFA 계정으로 테스트
2. 테스트 통과하면 PR 생성

---

## 서랍메모

- STS `GetSessionToken`은 IAM user 전용. IAM role은 `AssumeRole` 사용해야 함
- OTP 코드는 30초마다 바뀌니까 입력 직후 바로 API 호출해야 함
- `ExpiredToken` vs `ExpiredTokenException` - AWS 서비스마다 에러명이 다를 수 있음

---

## 내 질문 평가 및 피드백

- 설계 문서 검토 요청 → 에러 판별 규칙, 테스트 스코프 등 핵심 포인트 잘 짚어줌
- "구현 말고 문서만" 요청 → 바로 중단하고 문서 저장. 지시 따르는 거 좋음
- 커밋 요청 시 관련 파일만 선별해서 커밋. `.beads/` 실수로 포함됐지만 바로 정리함
