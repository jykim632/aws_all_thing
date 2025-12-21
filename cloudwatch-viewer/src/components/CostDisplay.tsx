"use client";

import { useEffect, useState } from "react";

interface CostSummary {
  date: string;
  apiCalls: number;
  dataTransferGB: number;
  estimatedApiCostUSD: number;
  estimatedTransferCostUSD: number;
  estimatedTotalCostUSD: number;
}

export function CostDisplay() {
  const [cost, setCost] = useState<CostSummary | null>(null);

  useEffect(() => {
    const fetchCost = async () => {
      try {
        const res = await fetch("/api/logs/cost");
        const data = await res.json();
        setCost(data);
      } catch {
        // 비용 조회 실패해도 무시
      }
    };

    fetchCost();

    // 10초마다 갱신
    const interval = setInterval(fetchCost, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!cost) {
    return null;
  }

  return (
    <div className="text-xs text-gray-500 flex items-center gap-3">
      <span title="오늘 API 호출 수">
        API: {cost.apiCalls.toLocaleString()}회
      </span>
      <span title="오늘 데이터 전송량">
        전송: {cost.dataTransferGB.toFixed(3)} GB
      </span>
      <span
        title="예상 비용 (API + 데이터 전송)"
        className="font-medium text-gray-700"
      >
        ${cost.estimatedTotalCostUSD.toFixed(4)}
      </span>
    </div>
  );
}
