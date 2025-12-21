# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CloudWatch Log Viewer - A web application to view AWS CloudWatch logs without navigating through the AWS Console. Built for solo development and operation with focus on maintainability and minimal operational risk.

## Development Commands

```bash
# Run from cloudwatch-viewer directory
cd cloudwatch-viewer

npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

```
cloudwatch-viewer/src/
├── app/
│   ├── page.tsx                    # Main UI - sidebar + log viewer layout
│   └── api/logs/
│       ├── groups/route.ts         # GET /api/logs/groups - list log groups
│       ├── events/route.ts         # GET /api/logs/events - query log events
│       └── cost/route.ts           # GET /api/logs/cost - cost tracking stats
├── lib/
│   ├── aws/
│   │   ├── client.ts               # Singleton CloudWatch client
│   │   └── logs.ts                 # Core API: fetchLogGroups, fetchLogEvents
│   ├── cache.ts                    # In-memory TTL cache (60s for groups, 5s for events)
│   └── cost-tracker.ts             # API call and data transfer tracking
└── components/
    ├── LogGroupList.tsx            # Sidebar log group selector
    ├── LogViewer.tsx               # Main log display area
    ├── TimeRangeSelector.tsx       # Time range dropdown
    └── CostDisplay.tsx             # Cost estimate display
```

**Key design decisions:**
- Uses `FilterLogEvents` API (not Logs Insights) for predictable costs
- Server-side caching to handle AWS rate limits (5 req/sec per log group)
- All AWS calls go through `lib/aws/logs.ts` which integrates caching and cost tracking

## Configuration

AWS credentials via `.env.local`:
```
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-northeast-2
```

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- AWS SDK v3 (`@aws-sdk/client-cloudwatch-logs`)
- TypeScript 5
