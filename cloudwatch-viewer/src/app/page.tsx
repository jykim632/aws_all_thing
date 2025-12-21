"use client";

import { useState } from "react";
import { LogGroupList } from "@/components/LogGroupList";
import { LogViewer } from "@/components/LogViewer";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import { CostDisplay } from "@/components/CostDisplay";

export default function Home() {
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [timeRange, setTimeRange] = useState(60 * 60 * 1000); // 1시간
  const [filterPattern, setFilterPattern] = useState("");

  return (
    <div className="flex h-screen bg-white">
      {/* 사이드바: 로그 그룹 목록 */}
      <aside className="w-72 border-r flex flex-col bg-gray-50">
        <div className="p-3 border-b bg-white">
          <h1 className="text-lg font-semibold text-gray-800">
            CloudWatch Logs
          </h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <LogGroupList
            onSelect={setSelectedGroup}
            selectedGroup={selectedGroup}
          />
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col">
        {/* 툴바 */}
        <header className="border-b p-3 flex items-center gap-4 bg-white">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

          <div className="flex-1">
            <input
              type="text"
              placeholder="필터 패턴 (예: ERROR, [INFO])"
              value={filterPattern}
              onChange={(e) => setFilterPattern(e.target.value)}
              className="w-full max-w-md px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <CostDisplay />
        </header>

        {/* 선택된 로그 그룹 표시 */}
        {selectedGroup && (
          <div className="px-4 py-2 bg-blue-50 border-b">
            <span className="text-sm text-blue-800 font-mono">
              {selectedGroup}
            </span>
          </div>
        )}

        {/* 로그 뷰어 */}
        <div className="flex-1 overflow-hidden">
          {selectedGroup ? (
            <LogViewer
              logGroupName={selectedGroup}
              timeRange={timeRange}
              filterPattern={filterPattern}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              왼쪽에서 로그 그룹을 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
