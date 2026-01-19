/**
 * CloudWatch Logs 조회 함수
 * 캐싱 및 비용 추적 통합
 */

import {
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  type LogGroup as AWSLogGroup,
  type FilteredLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";

import { getCloudWatchLogsClient } from "./client";
import {
  getCached,
  setCache,
  LOG_GROUPS_TTL,
  LOG_EVENTS_TTL,
} from "../cache";
import { trackApiCall, trackDataTransfer } from "../cost-tracker";
import type { AwsCredentials } from "@aws-internal/db/types";

// 타입 정의
export interface LogGroup {
  logGroupName: string;
  storedBytes: number;
  creationTime: number;
  retentionInDays?: number;
}

export interface LogEvent {
  timestamp: number;
  message: string;
  logStreamName: string;
  eventId?: string;
}

export interface FetchLogEventsParams {
  logGroupName: string;
  startTime: number;
  endTime: number;
  filterPattern?: string;
  limit?: number;
  nextToken?: string;
}

export interface FetchLogEventsResult {
  events: LogEvent[];
  nextToken?: string;
}

/**
 * 사용자별 캐시 키 생성
 * accessKeyId 앞 8자로 구분
 */
function getUserCachePrefix(credentials: AwsCredentials): string {
  return credentials.accessKeyId.slice(0, 8);
}

/**
 * 로그 그룹 목록 조회
 */
export async function fetchLogGroups(
  credentials: AwsCredentials,
  prefix?: string
): Promise<LogGroup[]> {
  // 캐시 확인 (사용자별)
  const userPrefix = getUserCachePrefix(credentials);
  const cacheKey = `${userPrefix}:log-groups:${prefix || "all"}`;
  const cached = getCached<LogGroup[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const client = getCloudWatchLogsClient(credentials);
  const allGroups: LogGroup[] = [];
  let nextToken: string | undefined;

  // 페이지네이션으로 전체 조회
  do {
    const command = new DescribeLogGroupsCommand({
      logGroupNamePrefix: prefix,
      nextToken,
      limit: 50,
    });

    const response = await client.send(command);

    // 비용 추적
    trackApiCall();
    trackDataTransfer(JSON.stringify(response).length);

    if (response.logGroups) {
      const groups = response.logGroups.map(mapLogGroup);
      allGroups.push(...groups);
    }

    nextToken = response.nextToken;
  } while (nextToken);

  // 캐시 저장
  setCache(cacheKey, allGroups, LOG_GROUPS_TTL);

  return allGroups;
}

/**
 * 로그 이벤트 조회
 */
export async function fetchLogEvents(
  credentials: AwsCredentials,
  params: FetchLogEventsParams
): Promise<FetchLogEventsResult> {
  const {
    logGroupName,
    startTime,
    endTime,
    filterPattern,
    limit = 100,
    nextToken,
  } = params;

  // 캐시 확인 (nextToken이 있으면 캐시 안 함, 사용자별)
  const userPrefix = getUserCachePrefix(credentials);
  const cacheKey = `${userPrefix}:log-events:${logGroupName}:${startTime}:${endTime}:${filterPattern || ""}`;
  if (!nextToken) {
    const cached = getCached<FetchLogEventsResult>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const client = getCloudWatchLogsClient(credentials);

  const command = new FilterLogEventsCommand({
    logGroupName,
    startTime,
    endTime,
    filterPattern: filterPattern || undefined,
    limit,
    nextToken,
  });

  const response = await client.send(command);

  // 비용 추적
  trackApiCall();
  trackDataTransfer(JSON.stringify(response).length);

  const result: FetchLogEventsResult = {
    events: (response.events || []).map(mapLogEvent),
    nextToken: response.nextToken,
  };

  // 첫 페이지만 캐시
  if (!nextToken) {
    setCache(cacheKey, result, LOG_EVENTS_TTL);
  }

  return result;
}

/**
 * AWS LogGroup → 내부 타입 변환
 */
function mapLogGroup(group: AWSLogGroup): LogGroup {
  return {
    logGroupName: group.logGroupName || "",
    storedBytes: group.storedBytes || 0,
    creationTime: group.creationTime || 0,
    retentionInDays: group.retentionInDays,
  };
}

/**
 * AWS FilteredLogEvent → 내부 타입 변환
 */
function mapLogEvent(event: FilteredLogEvent): LogEvent {
  return {
    timestamp: event.timestamp || 0,
    message: event.message || "",
    logStreamName: event.logStreamName || "",
    eventId: event.eventId,
  };
}
