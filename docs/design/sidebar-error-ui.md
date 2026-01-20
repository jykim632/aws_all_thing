# 사이드바 안내 UI 개선

## 목적

AWS credentials 미설정, MFA 인증 필요 등 상황별로 친절한 안내 UI를 사이드바에 표시하여 사용자 경험 개선.

---

## 현재 상태 분석

### 파일 위치
`apps/cloudwatch-viewer/src/components/LogGroupList.tsx`

관련 파일
- `apps/cloudwatch-viewer/src/components/LogViewer.tsx` (동일한 에러 처리 정책 적용 대상)

### 현재 에러 처리 (79-90줄)

```tsx
if (error) {
  return (
    <div className="p-4">
      <div className="text-red-500 text-sm mb-2">{error}</div>
      <button
        onClick={fetchLogGroups}
        className="text-sm text-blue-600 hover:underline"
      >
        다시 시도
      </button>
    </div>
  );
}
```

### 문제점

1. **모든 에러 동일 처리**: NO_CREDENTIALS, MFA_REQUIRED, 네트워크 에러 등 구분 없이 빨간 텍스트로만 표시
2. **행동 유도 부족**: "설정으로 이동", "MFA 인증하기" 같은 명확한 행동 안내 없음
3. **시각적 구분 부족**: 에러 심각도에 따른 색상 구분 없음

### 에러 코드 종류 (API 응답)

| 코드 | 의미 | 적절한 안내 |
|------|------|------------|
| `NO_CREDENTIALS` | AWS credentials 미설정 | 설정 페이지로 안내 |
| `INVALID_CREDENTIALS` | AWS credentials 유효하지 않음 | 설정 페이지로 안내 (재설정 유도) |
| `MFA_NOT_CONFIGURED` | MFA 정책 필요하나 MFA 미설정 | 설정 페이지로 안내 (MFA 설정 유도) |
| `MFA_REQUIRED` | MFA 인증 필요 (MFA 설정됨) | 안내 카드 + 버튼(클릭 시에만)으로 MFA 모달 열기 |
| `MFA_SESSION_EXPIRED` | MFA 세션 만료 | 안내 카드 + 버튼(클릭 시에만)으로 MFA 모달 열기 |
| `UNAUTHORIZED` | 로그인 필요/세션 만료 | 로그인 페이지로 안내 |
| (기타) | AWS API 에러 등 | 에러 메시지 + 재시도 |

추가 메모
- 클라이언트 공통 판별 함수는 `apps/cloudwatch-viewer/src/lib/aws/errors.ts`의 `isMfaError()`를 재사용한다.
- 이번 개선에서는 "에러 발생 시 MFA 모달 자동 오픈"은 하지 않는다. (사용자 버튼 클릭 시에만)

---

## 구현 계획

핵심 목표
- 사이드바(`LogGroupList`)와 로그 뷰어(`LogViewer`)의 에러 처리/UX를 동일 정책으로 맞춘다.
- 에러 코드 하드코딩/중복을 없애고 공통 로직으로 처리한다.
- 외부 데이터(`res.json()`)는 Zod로 파싱해서 런타임 안정성을 확보한다.

### 0단계: 공통 로직 확인/확장

이미 존재
- `apps/cloudwatch-viewer/src/lib/aws/errors.ts`: `isMfaError(errorCode)`

추가(권장)
- `isSettingsRequiredError(errorCode)`: `NO_CREDENTIALS | INVALID_CREDENTIALS | MFA_NOT_CONFIGURED`
- `isUnauthorizedError(errorCode)`: `UNAUTHORIZED`

또한, API 응답에서 `{ error: { code, message } }`를 안전하게 추출하는 공통 함수(예: `extractApiError`)를 두고 `LogGroupList`/`LogViewer`가 같이 사용한다.

### 1단계: 에러 상태 구조 변경

`error`/`errorCode`를 분리하면 불일치 상태가 생기기 쉽다. 에러 상태는 한 덩어리로 둔다.

```tsx
type UiError = { code?: string; message: string };
const [error, setError] = useState<UiError | null>(null);
```

### 2단계: API 응답 처리 수정 (MFA 자동 오픈 제거)

```tsx
const fetchLogGroups = async () => {
  try {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/logs/groups");
    const data = await res.json();

    // 공통 로직(Zod safeParse)으로 API 에러 추출
    const apiError = extractApiError(data);
    if (apiError) {
      // 중요: 여기서 MFA 모달을 자동으로 열지 않는다.
      // 사용자가 버튼을 눌렀을 때만 onMfaRequired() 호출.
      setError(apiError);
      return;
    }

    setLogGroups(data.logGroups);
  } catch (err) {
    setError({
      message: err instanceof Error ? err.message : "Failed to load log groups",
    });
  } finally {
    setLoading(false);
  }
};
```

### 3단계: 에러 UI 컴포넌트 분리

```tsx
// 에러 표시 헬퍼 함수
const renderError = () => {
  if (!error) return null;

  // 1) 설정으로 이동 (NO_CREDENTIALS / INVALID_CREDENTIALS)
  if (isSettingsRequiredError(error.code)) {
    return (
      <div className="p-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-amber-800 font-medium text-sm mb-2">
            AWS Credentials 설정 필요
          </div>
          <p className="text-amber-700 text-sm mb-3">
            {error.message}
          </p>
          <Link
            href="/settings"
            className="text-sm text-blue-600 hover:underline"
          >
            설정으로 이동 →
          </Link>
        </div>
      </div>
    );
  }

  // 2) MFA 안내 (MFA_REQUIRED / MFA_SESSION_EXPIRED)
  if (isMfaError(error.code)) {
    return (
      <div className="p-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-blue-800 font-medium text-sm mb-2">
            MFA 인증 필요
          </div>
          <p className="text-blue-700 text-sm mb-3">
            {error.message}
          </p>
          <button
            onClick={() => onMfaRequired?.()}
            className="text-sm text-blue-600 hover:underline"
          >
            MFA 인증하기 →
          </button>
        </div>
      </div>
    );
  }

  // 3) 로그인 안내 (UNAUTHORIZED)
  if (isUnauthorizedError(error.code)) {
    return (
      <div className="p-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-amber-800 font-medium text-sm mb-2">로그인 필요</div>
          <p className="text-amber-700 text-sm mb-3">{error.message}</p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            로그인으로 이동 →
          </Link>
        </div>
      </div>
    );
  }

  // 4) 기타 에러
  return (
    <div className="p-4">
      <div className="text-red-500 text-sm mb-2">{error.message}</div>
      <button
        onClick={fetchLogGroups}
        className="text-sm text-blue-600 hover:underline"
      >
        다시 시도
      </button>
    </div>
  );
};
```

### 4단계: 렌더링 부분 수정

```tsx
// 기존
if (error) {
  return (
    <div className="p-4">
      <div className="text-red-500 text-sm mb-2">{error}</div>
      ...
    </div>
  );
}

// 변경
if (error) {
  return renderError();
}
```

### 5단계: import 추가

```tsx
import Link from "next/link";  // 파일 상단에 추가
```

추가 import (공통 로직 사용 시)

```tsx
import {
  isMfaError,
  isSettingsRequiredError,
  isUnauthorizedError,
} from "@/lib/aws/errors";
import { extractApiError } from "@/lib/api/response";
```

---

## 전체 변경 요약

변경 포인트
- MFA 에러는 자동으로 모달을 열지 않고, 안내 카드에서 "MFA 인증하기" 버튼 클릭 시에만 오픈한다.
- `NO_CREDENTIALS`, `INVALID_CREDENTIALS`, `MFA_NOT_CONFIGURED`는 동일하게 "설정으로 이동"으로 유도한다.
- `UNAUTHORIZED`는 로그인 페이지로 유도한다.
- 사이드바(`LogGroupList`)와 뷰어(`LogViewer`)가 같은 공통 로직(`extractApiError`, `isMfaError` 등)으로 처리한다.
- logs API 응답/에러는 Zod 스키마로 파싱한다.
- **API route에서 MFA 정책 deny 에러 처리**: IAM 정책에 의한 explicit deny + MFA 관련 메시지일 경우, MFA 설정 여부를 확인하여 `MFA_REQUIRED` 또는 `MFA_NOT_CONFIGURED` 반환.

---

## 수정 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `apps/cloudwatch-viewer/src/components/LogGroupList.tsx` | 안내 카드 UI 추가(설정/MFA/로그인), MFA 자동 오픈 제거, 공통 로직으로 에러 분기 |
| `apps/cloudwatch-viewer/src/components/LogViewer.tsx` | LogGroupList와 동일 정책으로 에러 처리 통일(중복 제거, MFA 버튼 트리거) |
| `apps/cloudwatch-viewer/src/types/index.ts` | logs API 응답/에러 Zod 스키마 추가(런타임 파싱) |
| `apps/cloudwatch-viewer/src/lib/api/response.ts` | API 에러 응답 공통 추출 함수 추가 |
| `apps/cloudwatch-viewer/src/lib/aws/errors.ts` | 에러 코드 판별 함수 확장(`isSettingsRequiredError`에 `MFA_NOT_CONFIGURED` 포함) |
| `apps/cloudwatch-viewer/src/app/api/logs/groups/route.ts` | MFA 정책 deny 에러를 MFA 설정 여부에 따라 분기 처리 |
| `apps/cloudwatch-viewer/src/app/api/logs/events/route.ts` | 동일 |

---

## UI 디자인

### NO_CREDENTIALS / INVALID_CREDENTIALS / MFA_NOT_CONFIGURED 안내
- **배경**: amber-50 (연한 노란색)
- **테두리**: amber-200
- **제목**: "AWS Credentials 설정 필요" (amber-800)
- **설명**: 서버 `error.message` 그대로 표시
  - NO_CREDENTIALS: "AWS credentials not configured. Go to Settings."
  - INVALID_CREDENTIALS: "AWS credentials are invalid. Please update in Settings."
  - MFA_NOT_CONFIGURED: "이 리소스에 접근하려면 MFA 설정이 필요합니다."
- **액션**: "설정으로 이동 →" 링크 (blue-600)

### MFA 인증 필요 안내
- **배경**: blue-50 (연한 파란색)
- **테두리**: blue-200
- **제목**: "MFA 인증 필요" (blue-800)
- **설명**: 서버 `error.message` 그대로 표시
- **액션**: "MFA 인증하기 →" 버튼 (blue-600)

중요
- 에러 발생 시 모달을 자동으로 띄우지 않는다.
- 사용자가 "MFA 인증하기"를 눌렀을 때만 모달을 오픈한다.

### UNAUTHORIZED 안내
- **배경**: amber-50
- **테두리**: amber-200
- **제목**: "로그인 필요" (amber-800)
- **설명**: 서버 `error.message` 그대로 표시
- **액션**: "로그인으로 이동 →" 링크 (blue-600)

### 기타 에러 (기존 유지)
- **텍스트**: red-500
- **액션**: "다시 시도" 링크 (blue-600)

---

## 검증 방법

### 1. Credentials 미설정 테스트
1. DB에서 credentials 삭제 또는 새 계정으로 로그인
2. 메인 페이지 접근
3. **예상**: 사이드바에 amber 색상 안내 카드 표시 + "설정으로 이동" 링크

### 2. MFA 미설정 + MFA 정책 리소스 접근 테스트
1. MFA 미설정 credentials 저장 (mfaSerial 없음)
2. MFA 정책이 걸린 AWS 리소스 접근 시도
3. **예상**: 사이드바에 amber 색상 안내 카드 표시 + "설정으로 이동" 링크
4. **예상 메시지**: "이 리소스에 접근하려면 MFA 설정이 필요합니다."

### 3. MFA 인증 필요 테스트 (MFA 설정됨)
1. MFA 설정된 credentials 저장 (mfaSerial 있음)
2. MFA 인증 없이 메인 페이지 접근
3. **예상**: 사이드바에 blue 색상 안내 카드 표시 + "MFA 인증하기" 버튼
4. **예상**: 페이지 로드 시 MFA 모달이 자동으로 뜨지 않음
5. **예상**: 버튼 클릭 시에만 모달 오픈

### 4. MFA 세션 만료 테스트
1. MFA 인증 완료
2. 세션 만료 대기 (12시간) 또는 DB에서 temp_credentials 삭제
3. 페이지 새로고침
4. **예상**: "MFA 세션이 만료되었습니다" 메시지 표시

### 5. 기타 에러 테스트
1. IAM 권한 부족 credentials 사용 또는 네트워크 에러 상황 만들기
2. 메인 페이지 접근
3. **예상**: 빨간색 에러 메시지 + "다시 시도" 버튼

### 6. INVALID_CREDENTIALS 테스트
1. 잘못된 credentials 저장
2. 메인 페이지 접근
3. **예상**: NO_CREDENTIALS와 동일하게 "설정으로 이동" 링크 카드 표시

### 7. UNAUTHORIZED 테스트
1. 세션 만료/로그아웃 상태에서 메인 페이지 접근 또는 API 호출 유도
2. **예상**: 사이드바에 "로그인 필요" 카드 + "로그인으로 이동" 링크 표시

---

## 향후 개선 가능 사항 (이번 범위 아님)

- 사이드바 하단에 현재 인증 상태 표시 (credentials 유무, MFA 상태)
- 에러 시 자동 재시도 (exponential backoff)
- 설정 페이지 완료 후 자동 리다이렉트
