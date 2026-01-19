/**
 * 메모리 기반 캐시 유틸리티
 * 서버 재시작 시 초기화됨
 */

interface CacheEntry<T> {
  data: T;
  expireAt: number;
}

// TTL 상수 (밀리초)
export const LOG_GROUPS_TTL = 60_000; // 60초
export const LOG_EVENTS_TTL = 5_000; // 5초

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * 캐시에서 데이터 조회
 * 만료된 경우 null 반환
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * 캐시에 데이터 저장
 */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expireAt: Date.now() + ttlMs,
  });
}

/**
 * 특정 패턴과 일치하는 캐시 항목 삭제
 * 예: invalidateCache('log-events:') → 모든 로그 이벤트 캐시 삭제
 */
export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
}

/**
 * 전체 캐시 초기화
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * 캐시 통계 (디버깅용)
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
