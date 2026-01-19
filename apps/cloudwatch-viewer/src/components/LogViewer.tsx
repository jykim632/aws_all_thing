"use client";

import { useEffect, useState, useCallback } from "react";

interface LogEvent {
  timestamp: number;
  message: string;
  logStreamName: string;
}

interface LogViewerProps {
  logGroupName: string;
  timeRange: number;
  filterPattern: string;
  onMfaRequired?: () => void;
}

export function LogViewer({ logGroupName, timeRange, filterPattern, onMfaRequired }: LogViewerProps) {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!logGroupName) return;

    try {
      setLoading(true);
      setError(null);

      const endTime = Date.now();
      const startTime = endTime - timeRange;

      const params = new URLSearchParams({
        logGroupName,
        startTime: String(startTime),
        endTime: String(endTime),
        limit: "200",
      });

      if (filterPattern) {
        params.set("filterPattern", filterPattern);
      }

      const res = await fetch(`/api/logs/events?${params}`);
      const data = await res.json();

      if (data.error) {
        // MFA 에러 체크
        if (
          data.error.code === "MFA_REQUIRED" ||
          data.error.code === "MFA_SESSION_EXPIRED"
        ) {
          onMfaRequired?.();
          setError("MFA 인증이 필요합니다.");
          return;
        }
        throw new Error(data.error.message);
      }

      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [logGroupName, timeRange, filterPattern, onMfaRequired]);

  useEffect(() => {
    fetchLogs();

    // 10초마다 자동 새로고침 (on일 때만)
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, autoRefresh]);

  const formatTimestamp = (ts: number): string => {
    return new Date(ts).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">로그 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-red-500">{error}</div>
        <button
          onClick={fetchLogs}
          className="text-sm text-blue-600 hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">
          {filterPattern
            ? `"${filterPattern}" 패턴과 일치하는 로그가 없습니다`
            : "선택한 시간 범위에 로그가 없습니다"}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {events.length}개 이벤트
          </span>
          {loading && <span className="text-xs text-blue-500">갱신 중...</span>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
              autoRefresh
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            {autoRefresh ? "자동 새로고침 ON" : "자동 새로고침 OFF"}
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 로그 목록 (최신순) */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {[...events].reverse().map((event, index) => (
          <div
            key={`${event.timestamp}-${index}`}
            className="px-4 py-1.5 border-b hover:bg-gray-50 flex gap-3"
          >
            <span className="text-gray-400 whitespace-nowrap shrink-0">
              {formatTimestamp(event.timestamp)}
            </span>
            <span
              className={`whitespace-pre-wrap break-all ${
                event.message.includes("ERROR") || event.message.includes("error")
                  ? "text-red-600"
                  : event.message.includes("WARN") || event.message.includes("warn")
                  ? "text-yellow-600"
                  : "text-gray-800"
              }`}
            >
              {event.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
