# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

CloudWatch Log Viewer - AWS Console을 거치지 않고 CloudWatch 로그를 조회하는 웹 애플리케이션. 혼자 개발/운영하는 것을 전제로, 유지보수성과 운영 리스크 최소화에 중점을 둠.

## 개발 명령어

```bash
# cloudwatch-viewer 디렉토리에서 실행
cd cloudwatch-viewer

npm run dev      # 개발 서버 시작 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버 시작
npm run lint     # ESLint 실행
```

## 아키텍처

```
cloudwatch-viewer/src/
├── app/
│   ├── page.tsx                    # 메인 UI - 사이드바 + 로그 뷰어 레이아웃
│   └── api/logs/
│       ├── groups/route.ts         # GET /api/logs/groups - 로그 그룹 목록
│       ├── events/route.ts         # GET /api/logs/events - 로그 이벤트 조회
│       └── cost/route.ts           # GET /api/logs/cost - 비용 추적 통계
├── lib/
│   ├── aws/
│   │   ├── client.ts               # 싱글톤 CloudWatch 클라이언트
│   │   └── logs.ts                 # 핵심 API: fetchLogGroups, fetchLogEvents
│   ├── cache.ts                    # 인메모리 TTL 캐시 (그룹 60초, 이벤트 5초)
│   └── cost-tracker.ts             # API 호출 및 데이터 전송량 추적
└── components/
    ├── LogGroupList.tsx            # 사이드바 로그 그룹 선택기
    ├── LogViewer.tsx               # 메인 로그 표시 영역
    ├── TimeRangeSelector.tsx       # 시간 범위 드롭다운
    └── CostDisplay.tsx             # 비용 추정치 표시
```

**핵심 설계 결정:**
- `FilterLogEvents` API 사용 (Logs Insights 대신) - 비용 예측 가능
- 서버 사이드 캐싱으로 AWS Rate Limit 대응 (로그 그룹당 5회/초)
- 모든 AWS 호출은 `lib/aws/logs.ts`를 통해 처리 (캐싱 + 비용 추적 통합)

## 설정

AWS 자격 증명은 `.env.local`에 설정:
```
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-northeast-2
```

## 기술 스택

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- AWS SDK v3 (`@aws-sdk/client-cloudwatch-logs`)
- TypeScript 5
