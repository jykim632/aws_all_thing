"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { extractApiError } from "@/lib/api/response";
import {
  isMfaError,
  isSettingsRequiredError,
  isUnauthorizedError,
} from "@/lib/aws/errors";
import type { UiError } from "@/types";

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
  const [error, setError] = useState<UiError | null>(null);
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

      const apiError = extractApiError(data);
      if (apiError) {
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
            <p className="text-amber-700 text-sm mb-3">{error.message}</p>
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
            <p className="text-blue-700 text-sm mb-3">{error.message}</p>
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
            <div className="text-amber-800 font-medium text-sm mb-2">
              로그인 필요
            </div>
            <p className="text-amber-700 text-sm mb-3">{error.message}</p>
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:underline"
            >
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

  if (error) {
    return renderError();
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
