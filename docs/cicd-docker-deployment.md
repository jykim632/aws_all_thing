# CI/CD + Docker 배포 가이드

## 개요

- **CI/CD**: GitLab CI
- **컨테이너**: Docker + docker-compose
- **배포 서버**: Linux (Ubuntu/CentOS)

---

## 아키텍처

```
[GitLab] → [GitLab CI] → [Container Registry] → [배포 서버]
                              ↓
                        docker compose pull
                              ↓
                        docker compose up
```

### 파이프라인 흐름

```
[push] → [lint] → [build] → [deploy:staging] → [deploy:production]
                                  (auto)            (manual)
```

---

## 파일 구조

```
aws/
├── .gitlab-ci.yml                    # CI/CD 파이프라인
├── docker-compose.yml                # 서비스 오케스트레이션
├── .env.example                      # 환경변수 템플릿
├── scripts/
│   ├── setup-server.sh              # 서버 초기 설정 (1회)
│   ├── deploy.sh                    # 배포 스크립트
│   └── rollback.sh                  # 롤백 스크립트
└── apps/cloudwatch-viewer/
    ├── Dockerfile                   # 멀티스테이지 빌드
    └── .dockerignore
```

---

## 1. Dockerfile

### 멀티스테이지 빌드

```dockerfile
# ==========================================
# Stage 1: Base - pnpm 설치
# ==========================================
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache python3 make g++  # better-sqlite3 빌드용

# ==========================================
# Stage 2: Dependencies
# ==========================================
FROM base AS deps
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/cloudwatch-viewer/package.json ./apps/cloudwatch-viewer/

RUN pnpm install --frozen-lockfile

# ==========================================
# Stage 3: Builder
# ==========================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/cloudwatch-viewer/node_modules ./apps/cloudwatch-viewer/node_modules
COPY . .

ENV NODE_ENV=production

WORKDIR /app/apps/cloudwatch-viewer
RUN pnpm build

# ==========================================
# Stage 4: Runner - 최소 런타임
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libstdc++

ENV NODE_ENV=production

COPY --from=builder /app/apps/cloudwatch-viewer/.next/standalone ./
COPY --from=builder /app/apps/cloudwatch-viewer/.next/static ./.next/static
COPY --from=builder /app/apps/cloudwatch-viewer/public ./public

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
```

### next.config.ts 수정 필요

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  transpilePackages: [
    "@aws-internal/auth",
    "@aws-internal/db",
    "@aws-internal/ui",
  ],
};
```

---

## 2. docker-compose.yml

```yaml
version: '3.8'

services:
  cloudwatch-viewer:
    build:
      context: .
      dockerfile: ./apps/cloudwatch-viewer/Dockerfile
    image: aws-internal/cloudwatch-viewer:${TAG:-latest}
    container_name: cloudwatch-viewer
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - LDAP_URL=${LDAP_URL}
      - LDAP_BIND_DN=${LDAP_BIND_DN}
      - LDAP_BIND_PASSWORD=${LDAP_BIND_PASSWORD}
      - LDAP_BASE_DN=${LDAP_BASE_DN}
      - LDAP_USER_FILTER=${LDAP_USER_FILTER}
      - LDAP_TLS_ENABLED=${LDAP_TLS_ENABLED:-false}
    volumes:
      - cloudwatch-data:/app/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/auth/me"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 향후 추가
  # billing-dashboard:
  #   ...

volumes:
  cloudwatch-data:
```

---

## 3. GitLab CI (.gitlab-ci.yml)

```yaml
stages:
  - validate
  - build
  - deploy

variables:
  DOCKER_HOST: tcp://docker:2375
  REGISTRY: $CI_REGISTRY
  IMAGE_TAG: $CI_COMMIT_SHORT_SHA
  PNPM_VERSION: "9.15.4"

# 캐시 설정
.pnpm-cache: &pnpm-cache
  cache:
    key:
      files:
        - pnpm-lock.yaml
    paths:
      - .pnpm-store/

# Lint
lint:
  stage: validate
  image: node:20-alpine
  <<: *pnpm-cache
  before_script:
    - corepack enable
    - corepack prepare pnpm@$PNPM_VERSION --activate
    - pnpm config set store-dir .pnpm-store
    - pnpm install --frozen-lockfile
  script:
    - pnpm lint
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Build Docker Image
build:cloudwatch-viewer:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - |
      docker build \
        -f apps/cloudwatch-viewer/Dockerfile \
        -t $REGISTRY/aws-internal/cloudwatch-viewer:$IMAGE_TAG \
        -t $REGISTRY/aws-internal/cloudwatch-viewer:latest \
        .
    - docker push $REGISTRY/aws-internal/cloudwatch-viewer:$IMAGE_TAG
    - docker push $REGISTRY/aws-internal/cloudwatch-viewer:latest
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Deploy
.deploy-template: &deploy-template
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | ssh-add -
    - mkdir -p ~/.ssh
    - echo "$SSH_KNOWN_HOSTS" >> ~/.ssh/known_hosts

deploy:staging:
  <<: *deploy-template
  environment:
    name: staging
  script:
    - |
      ssh $STAGING_USER@$STAGING_HOST "
        cd /opt/aws-internal && \
        docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY && \
        TAG=$IMAGE_TAG docker compose pull cloudwatch-viewer && \
        TAG=$IMAGE_TAG docker compose up -d cloudwatch-viewer
      "
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy:production:
  <<: *deploy-template
  environment:
    name: production
  script:
    - |
      ssh $PRODUCTION_USER@$PRODUCTION_HOST "
        cd /opt/aws-internal && \
        docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY && \
        TAG=$IMAGE_TAG docker compose pull cloudwatch-viewer && \
        TAG=$IMAGE_TAG docker compose up -d cloudwatch-viewer
      "
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
```

---

## 4. 배포 스크립트

### scripts/setup-server.sh (서버 초기 설정)

```bash
#!/bin/bash
set -e

INSTALL_DIR="/opt/aws-internal"

sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# 환경변수 파일 템플릿
cat > .env << 'EOF'
TAG=latest
SESSION_SECRET=
LDAP_URL=
LDAP_BIND_DN=
LDAP_BIND_PASSWORD=
LDAP_BASE_DN=
LDAP_USER_FILTER=(uid={{username}})
LDAP_TLS_ENABLED=false
EOF

echo "환경변수 파일을 수정하세요: $INSTALL_DIR/.env"
```

### scripts/deploy.sh

```bash
#!/bin/bash
set -e

APP_NAME=${1:-cloudwatch-viewer}
IMAGE_TAG=${2:-latest}
INSTALL_DIR="/opt/aws-internal"

cd $INSTALL_DIR

echo "=== Deploying $APP_NAME:$IMAGE_TAG ==="
TAG=$IMAGE_TAG docker compose pull $APP_NAME
TAG=$IMAGE_TAG docker compose up -d $APP_NAME

sleep 10
docker compose ps $APP_NAME
docker image prune -f
```

### scripts/rollback.sh

```bash
#!/bin/bash
set -e

APP_NAME=${1:-cloudwatch-viewer}
PREVIOUS_TAG=${2}

if [ -z "$PREVIOUS_TAG" ]; then
    echo "Usage: ./rollback.sh <app-name> <previous-tag>"
    exit 1
fi

cd /opt/aws-internal
TAG=$PREVIOUS_TAG docker compose up -d $APP_NAME
echo "=== Rollback to $PREVIOUS_TAG complete ==="
```

---

## 5. 환경변수 (.env.example)

```bash
# 버전 (CI에서 자동 설정)
TAG=latest

# Session (32자 이상 필수)
SESSION_SECRET=your-secret-key-at-least-32-chars

# LDAP 인증
LDAP_URL=ldap://ldap.company.com:389
LDAP_BIND_DN=cn=service,dc=company,dc=com
LDAP_BIND_PASSWORD=ldap-password
LDAP_BASE_DN=ou=users,dc=company,dc=com
LDAP_USER_FILTER=(uid={{username}})
LDAP_TLS_ENABLED=false
```

---

## 6. GitLab CI/CD Variables 설정

GitLab → Settings → CI/CD → Variables에 추가:

| Variable | Type | Protected | Masked |
|----------|------|-----------|--------|
| `SSH_PRIVATE_KEY` | File | Yes | Yes |
| `SSH_KNOWN_HOSTS` | Variable | No | No |
| `STAGING_HOST` | Variable | No | No |
| `STAGING_USER` | Variable | No | No |
| `PRODUCTION_HOST` | Variable | Yes | No |
| `PRODUCTION_USER` | Variable | Yes | No |

---

## 7. 로컬 테스트

```bash
# Docker 이미지 빌드
docker build -f apps/cloudwatch-viewer/Dockerfile -t cw-viewer:test .

# 컨테이너 실행
docker run -p 3001:3000 \
  -e SESSION_SECRET=dev-secret-at-least-32-characters \
  -e DEV_SKIP_LDAP=true \
  -v $(pwd)/data:/app/data \
  cw-viewer:test

# 접속 테스트
curl http://localhost:3001/login
```

---

## 8. 앱 추가 시 (billing-dashboard)

1. `apps/billing-dashboard/Dockerfile` 생성
2. `docker-compose.yml`에 서비스 추가 (포트 3002)
3. `.gitlab-ci.yml`에 build/deploy job 추가

---

## 주의사항

### better-sqlite3 네이티브 모듈

- Docker 빌드 시 Linux용으로 리빌드됨
- `python3`, `make`, `g++` 필요 (base 스테이지에 포함)

### SQLite 데이터 영속성

- `/app/data`를 Docker volume으로 마운트
- 백업: `docker exec cloudwatch-viewer sqlite3 /app/data/cloudwatch-viewer.db ".backup /app/data/backup.db"`

### 보안

- `.env` 파일은 서버에서만 관리 (git에 커밋 X)
- `SESSION_SECRET`은 최소 32자 랜덤 문자열
- GitLab Variables에 민감 정보 저장
