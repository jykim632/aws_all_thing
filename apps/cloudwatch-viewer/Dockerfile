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
COPY --from=builder /app/apps/cloudwatch-viewer/.next/static ./apps/cloudwatch-viewer/.next/static
COPY --from=builder /app/apps/cloudwatch-viewer/public ./apps/cloudwatch-viewer/public

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "apps/cloudwatch-viewer/server.js"]
