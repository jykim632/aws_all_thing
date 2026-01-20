# 설정 페이지 UI 개선: 필드별 개별 수정

## 목표
AWS 자격증명이 저장된 상태에서는 입력 폼을 숨기고, 각 필드별로 개별 수정 가능하게 변경

## 수정 파일
- `apps/cloudwatch-viewer/src/components/CredentialsForm.tsx` - UI
- `apps/cloudwatch-viewer/src/app/api/credentials/route.ts` - PATCH API 추가

---

## API 변경

### PATCH /api/credentials
필드별 부분 업데이트 지원

**Request Body (모두 optional, 최소 1개 필수):**
```typescript
{
  // 쌍으로만 변경 가능 (둘 다 있거나 둘 다 없거나)
  accessKeyId?: string;
  secretAccessKey?: string;

  // 단독 변경 가능
  region?: string;
  mfaSerial?: string | null;  // null이면 MFA 삭제
}
```

**Validation:**
- `accessKeyId`와 `secretAccessKey`는 항상 함께 전송해야 함
- 둘 중 하나만 있으면 400 에러

**Response:**
```typescript
// 성공: 200
{ success: true }

// 실패: 400
{ error: { message: "accessKeyId and secretAccessKey must be provided together" } }
```

---

## UI 변경

### 필드별 편집 상태
```typescript
const [editingField, setEditingField] = useState<
  "none" | "keys" | "region" | "mfa"
>("none");
```

### 자격증명 저장된 상태 (기본)
```
┌─────────────────────────────────────────────────────┐
│ ✓ AWS Credentials Configured                       │
│                                                     │
│   Access Key: AKIA****EXAMPLE          [변경]      │
│   Region: ap-northeast-2               [변경]      │
│   MFA: arn:aws:iam::***:mfa/user       [변경]      │
│        (또는 "미설정"일 때 [설정])                  │
│                                                     │
│   [Delete All]                                      │
└─────────────────────────────────────────────────────┘
```

### Access Key 변경 클릭 시
```
┌─────────────────────────────────────────────────────┐
│   Access Key: AKIA****EXAMPLE                       │
│   ┌───────────────────────────────────────────┐    │
│   │ New Access Key ID: [                    ] │    │
│   │ New Secret Key:    [                    ] │    │
│   │                      [취소]  [저장]       │    │
│   └───────────────────────────────────────────┘    │
│   Region: ap-northeast-2               [변경]      │
│   MFA: ...                             [변경]      │
└─────────────────────────────────────────────────────┘
```

### Region 변경 클릭 시
```
│   Region: [▼ ap-northeast-2  ]  [취소]  [저장]     │
```

### MFA 변경 클릭 시
```
│   MFA:                                              │
│   ┌───────────────────────────────────────────┐    │
│   │ MFA Device ARN: [                       ] │    │
│   │ (비워두면 MFA 삭제)                        │    │
│   │                      [취소]  [저장]       │    │
│   └───────────────────────────────────────────┘    │
```

---

## 구현 상세

### 1. API - PATCH 핸들러 추가

```typescript
// route.ts
export async function PATCH(request: NextRequest) {
  // 1. 세션 확인
  // 2. body 파싱 & 검증
  //    - accessKeyId, secretAccessKey 쌍 검증
  // 3. 기존 credentials 조회
  // 4. 변경된 필드만 업데이트
  // 5. DB 저장
}
```

### 2. UI - 필드별 편집 컴포넌트

```typescript
// 각 필드별 인라인 편집 UI
function EditableField({
  label,
  value,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  children  // 편집 폼
}) { ... }
```

### 3. 버튼 동작

| 버튼 | 동작 |
|------|------|
| [변경] | `setEditingField("keys" \| "region" \| "mfa")` |
| [취소] | `setEditingField("none")` |
| [저장] | PATCH 호출 → 성공 시 `setEditingField("none")` |
| [Delete All] | 기존 DELETE 호출 |

### 4. 자격증명 없을 때

기존처럼 전체 폼 표시 (POST로 전체 저장)

---

## 검증 방법

1. `npm run dev`로 개발 서버 실행
2. 설정 페이지에서:
   - 자격증명 없을 때 → 전체 폼 표시
   - 저장 후 → 요약 뷰 + 각 필드 [변경] 버튼
   - Access Key [변경] → Key 쌍 입력 폼, 저장 시 PATCH
   - Region [변경] → 드롭다운, 저장 시 PATCH
   - MFA [변경] → ARN 입력, 저장 시 PATCH (빈 값이면 삭제)
   - [취소] → 편집 모드 종료
