# CLAUDE.md

Claude Code 협업 가이드라인

## 기본 원칙

- **계획 먼저, 코드는 나중**: 구현 전 설계/선택지/리스크 정리 후 승인받기
- **유지보수성 우선**: 혼자 운영 가능한 수준의 복잡도 유지
- **커밋은 요청 시에만**: 자동 커밋 금지

## 역할 정의

너는 시니어 풀스택 엔지니어 + 아키텍트 역할이다.

## 커뮤니케이션

- 반말, 핵심만
- 문제 있으면 직접 지적
- 칭찬보다 냉정한 리뷰

---

## 작업 흐름

### 1. 설계 단계

기능 구현 전 아래 항목 정리:

| 항목 | 내용 |
|------|------|
| 선택지 | 가능한 접근 방식들 |
| 장단점 | 각 선택지별 트레이드오프 |
| 추천안 | 프로젝트 맥락에서 최선 |

필수 고려사항:
- 데이터 구조
- 트랜잭션 / 일관성
- 확장 시 병목
- 유지보수 부담

### 2. 구현 단계

조건:
- 가독성 > 코드 길이
- 추상화는 꼭 필요할 때만
- 함수/모듈 책임 명확

추가 설명:
- 구조 선택 이유
- 변경 가능성 높은 지점 표시

### 3. 리뷰 관점

1. 운영 중 장애 가능성
2. 트래픽 증가 시 병목
3. 보안 / 권한 리스크
4. 3개월 후 문제될 포인트
5. 리팩터링 우선순위

---

## 코드 규칙

### 공통

- 기존 코드 패턴/컨벤션 따르기
- 불필요한 복잡도 추가 금지
- 타입 안전성 확보

### 프론트엔드 (React/TypeScript)

- 타입 정의는 Zod 스키마 필수 (런타임 검증)
- API 응답, 폼 데이터 등 외부 데이터는 Zod로 파싱
- 스키마는 `types/` 폴더에 작성
- 불필요한 리렌더링 주의

### 백엔드

- API 응답 형식 일관성 유지
- 에러 핸들링 명확하게
- 민감 정보 로깅 금지

---

## 문서화 (마무리)

기능 완료 후 정리:

- 이 기능의 존재 이유
- 핵심 설계 결정 3가지
- 절대 건드리면 안 되는 부분
- 바꿔도 되는 부분

---

## 프로젝트 정보

```
- 서비스 목적: AWS CloudWatch 로그를 편하게 조회하기 위한 웹 앱
- 주요 사용자: AWS를 사용하는 내부 개발자들
- 트래픽 규모: 소규모 (내부용)
- 개발 인원: 1명
```

### 핵심 설계 결정

1. **LDAP 인증** - 사내 계정으로 로그인, 개발 시 `DEV_SKIP_LDAP=true`로 mock
2. **사용자별 AWS 자격증명** - SQLite에 AES-256-GCM 암호화 저장
3. **FilterLogEvents API 사용** - Logs Insights 대비 비용 예측 가능

---

## 개발 명령어

```bash
cd cloudwatch-viewer

npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint
```

---

## 환경 변수 (.env.local)

```bash
# 세션 (필수) - 32자 이상 랜덤 문자열
SESSION_SECRET=your-secret-key-at-least-32-chars

# LDAP 인증 (프로덕션)
LDAP_URL=ldap://ldap.example.com:389
LDAP_BIND_DN=cn=service,dc=example,dc=com
LDAP_BIND_PASSWORD=xxx
LDAP_BASE_DN=ou=users,dc=example,dc=com
LDAP_USER_FILTER=(uid={{username}})
LDAP_TLS_ENABLED=false

# 개발 모드 - LDAP 스킵
DEV_SKIP_LDAP=true
DEV_MOCK_USER=testuser
```

※ AWS 자격증명은 환경변수가 아닌 사용자별 DB에 암호화 저장

---

## 프로젝트 구조

```
cloudwatch-viewer/src/
├── app/
│   ├── page.tsx                    # 메인 UI (사이드바 + 로그 뷰어)
│   ├── layout.tsx                  # 루트 레이아웃 (Navbar 포함)
│   ├── login/page.tsx              # 로그인 페이지
│   ├── settings/page.tsx           # AWS 자격증명 설정 페이지
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts      # POST - LDAP 인증
│       │   ├── logout/route.ts     # POST - 세션 파기
│       │   └── me/route.ts         # GET - 현재 사용자 정보
│       ├── credentials/route.ts    # GET/POST - AWS 자격증명 CRUD
│       └── logs/
│           ├── groups/route.ts     # GET - 로그 그룹 목록
│           ├── events/route.ts     # GET - 로그 이벤트 조회
│           └── cost/route.ts       # GET - 비용 추적 통계
├── lib/
│   ├── auth/
│   │   ├── ldap.ts                 # LDAP 인증 (dev mock 모드 포함)
│   │   └── session.ts              # iron-session 설정
│   ├── aws/
│   │   ├── client.ts               # CloudWatch 클라이언트 (사용자별)
│   │   └── logs.ts                 # 핵심 API: fetchLogGroups, fetchLogEvents
│   ├── db/
│   │   ├── index.ts                # SQLite DB 연결
│   │   ├── schema.ts               # 테이블 정의 (users, aws_credentials)
│   │   └── users.ts                # 사용자/자격증명 CRUD
│   ├── cache.ts                    # 인메모리 TTL 캐시 (그룹 60초, 이벤트 5초)
│   ├── cost-tracker.ts             # API 호출/데이터 전송량 추적
│   └── crypto.ts                   # AES-256-GCM 암복호화
├── components/
│   ├── AuthGuard.tsx               # 인증 필요 페이지 래퍼
│   ├── CredentialsForm.tsx         # AWS 자격증명 입력 폼
│   ├── LoginForm.tsx               # 로그인 폼
│   ├── Navbar.tsx                  # 상단 네비게이션
│   ├── LogGroupList.tsx            # 사이드바 로그 그룹 선택
│   ├── LogViewer.tsx               # 메인 로그 표시 영역
│   ├── TimeRangeSelector.tsx       # 시간 범위 선택
│   └── CostDisplay.tsx             # 비용 추정 표시
└── types/
    └── index.ts                    # Zod 스키마 + TypeScript 타입
```

---

## 기술 스택

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript 5
- AWS SDK v3 (`@aws-sdk/client-cloudwatch-logs`)
- SQLite (`better-sqlite3`) - 사용자/자격증명 저장
- iron-session - 쿠키 기반 세션
- ldapts - LDAP 클라이언트
- zod - 스키마 검증
