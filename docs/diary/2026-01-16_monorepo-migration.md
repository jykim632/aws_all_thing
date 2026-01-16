# 2026-01-16 모노레포 마이그레이션

## 작업한 내용

cloudwatch-viewer 프로젝트를 pnpm workspaces 모노레포로 전환

### 변경사항
- 루트에 `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json` 생성
- 공유 패키지 3개 분리:
  - `@aws-internal/auth`: LDAP 인증 + iron-session 설정
  - `@aws-internal/db`: SQLite 연결 + AES-256-GCM 암호화 + 사용자 CRUD
  - `@aws-internal/ui`: AuthGuard, LoginForm 컴포넌트
- `cloudwatch-viewer/` → `apps/cloudwatch-viewer/` 이동
- 8개 API 라우트 + 컴포넌트 import 경로 수정

### 최종 구조
```
aws/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── packages/
│   ├── auth/
│   ├── db/
│   └── ui/
└── apps/
    └── cloudwatch-viewer/
```

## 왜 했는지 (맥락)

- billing-dashboard 등 AWS 관련 사내 도구 추가 예정
- 앱 간 인증(LDAP), DB(사용자/자격증명) 공유 필요
- 하나의 저장소에서 관리하면 의존성/버전 동기화 편함

## 논의/아이디어/고민

### 모노레포 도구 선택
| 도구 | 결론 |
|------|------|
| pnpm workspaces | 채택 - 단순함, 1인 개발에 적합 |
| Turborepo | 보류 - 빌드 캐싱 필요하면 나중에 |
| Nx | 기각 - 오버킬 |

### 공유 범위
- `Navbar`, `CredentialsForm`은 앱 전용 유지 (props 변경 필요해서)
- `AuthGuard`, `LoginForm`만 공유 패키지로

### 기존 데이터 호환성
- 암호화 salt(`cloudwatch-viewer-salt`) 변경하면 기존 credentials 복호화 불가
- 마이그레이션 시 기존 salt 그대로 유지하도록 설계

## 결정된 내용

1. **pnpm workspaces** 사용 (Turborepo 없이)
2. 패키지 이름: `@aws-internal/*`
3. DB 경로/salt는 앱별로 `initDb()` 호출 시 지정
4. 세션 쿠키 이름도 앱별로 `createSessionOptions()` 호출 시 지정

## 느낀 점/난이도/발견

### 난이도: 중

### 발견
- ldapts v8에서 `Filter`가 abstract 클래스로 변경됨 → `escapeLdapFilter()` 직접 구현
- Next.js 16에서 workspace 패키지 사용 시 `transpilePackages` 필수
- pnpm은 기존 npm의 `package-lock.json` 자동 무시 (삭제 필요)

### 삽질
- `@types/react` 가 패키지에 없어서 빌드 실패 → devDependencies에 추가

## 남은 것/미정

- [ ] billing-dashboard 앱 생성
- [ ] 앱 간 DB 공유 여부 (현재는 앱별 분리)
- [ ] Turborepo 도입 검토 (앱 늘어나면)

## 다음 액션

1. billing-dashboard 시작 시 `apps/billing-dashboard/` 생성
2. workspace 의존성 추가:
   ```json
   {
     "@aws-internal/auth": "workspace:*",
     "@aws-internal/db": "workspace:*",
     "@aws-internal/ui": "workspace:*"
   }
   ```
3. `src/lib/init.ts`에서 DB 초기화 (새 salt 사용)

## 실행 명령어

```bash
# 전체 설치
pnpm install

# cloudwatch-viewer 개발
pnpm dev:cw

# 빌드
pnpm build:cw
```

---

## 서랍메모

### 암호화 키 유도
```
SESSION_SECRET + salt → scryptSync → 256-bit key → AES-256-GCM
```
salt 바꾸면 키 바뀜 → 기존 데이터 복호화 불가. 마이그레이션 시 주의.

### ldapts v8 Filter escape
```typescript
function escapeLdapFilter(value: string): string {
  return value.replace(/[*()\\\/\0]/g, (char) => {
    return "\\" + char.charCodeAt(0).toString(16).padStart(2, "0");
  });
}
```

---

## 내 질문 평가 및 피드백

### 잘한 점
- 모노레포 필요성 먼저 확인 (빌링 대시보드 곧 시작? 배포 환경? 공유 범위?)
- 선택지/장단점 정리 후 추천안 제시

### 개선점
- 없음 - 적절한 수준의 질문이었음
