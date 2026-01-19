"use client";

import { useEffect, useState } from "react";

interface LogGroup {
  logGroupName: string;
  storedBytes: number;
  creationTime: number;
}

interface LogGroupListProps {
  onSelect: (logGroupName: string) => void;
  selectedGroup?: string;
  onMfaRequired?: () => void;
}

export function LogGroupList({ onSelect, selectedGroup, onMfaRequired }: LogGroupListProps) {
  const [logGroups, setLogGroups] = useState<LogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogGroups();
  }, []);

  const fetchLogGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/logs/groups");
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

      setLogGroups(data.logGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load log groups");
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = logGroups.filter((group) =>
    group.logGroupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col h-full">
      {/* 검색 */}
      <div className="p-2 border-b">
        <input
          type="text"
          placeholder="로그 그룹 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            {searchTerm ? "검색 결과가 없습니다" : "로그 그룹이 없습니다"}
          </div>
        ) : (
          <ul>
            {filteredGroups.map((group) => (
              <li key={group.logGroupName}>
                <button
                  onClick={() => onSelect(group.logGroupName)}
                  className={`w-full text-left px-3 py-2 text-sm border-b hover:bg-gray-50 transition-colors ${
                    selectedGroup === group.logGroupName
                      ? "bg-blue-50 border-l-2 border-l-blue-600"
                      : ""
                  }`}
                >
                  <div className="font-mono text-xs truncate" title={group.logGroupName}>
                    {group.logGroupName}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatBytes(group.storedBytes)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 카운트 */}
      <div className="p-2 border-t text-xs text-gray-500">
        {filteredGroups.length} / {logGroups.length} 그룹
      </div>
    </div>
  );
}
