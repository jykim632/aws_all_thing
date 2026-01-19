/**
 * API 호출 비용 추적 (메모리 기반)
 * 서버 재시작 시 초기화됨
 */

interface CostData {
  date: string; // YYYY-MM-DD (UTC)
  apiCalls: number;
  dataTransferBytes: number;
}

// 비용 상수
const API_COST_PER_1000 = 0.01; // $0.01 per 1,000 API calls
const TRANSFER_COST_PER_GB = 0.09; // $0.09 per GB (100GB 초과분)
const FREE_TRANSFER_GB = 100; // 월 100GB 무료

let costData: CostData = {
  date: "",
  apiCalls: 0,
  dataTransferBytes: 0,
};

/**
 * 날짜가 바뀌었으면 데이터 리셋
 */
function resetIfNewDay(): void {
  const today = new Date().toISOString().split("T")[0];
  if (costData.date !== today) {
    costData = {
      date: today,
      apiCalls: 0,
      dataTransferBytes: 0,
    };
  }
}

/**
 * API 호출 1회 기록
 */
export function trackApiCall(): void {
  resetIfNewDay();
  costData.apiCalls++;
}

/**
 * 데이터 전송량 기록
 */
export function trackDataTransfer(bytes: number): void {
  resetIfNewDay();
  costData.dataTransferBytes += bytes;
}

/**
 * 비용 요약 조회
 */
export function getCostSummary(): {
  date: string;
  apiCalls: number;
  dataTransferBytes: number;
  dataTransferGB: number;
  estimatedApiCostUSD: number;
  estimatedTransferCostUSD: number;
  estimatedTotalCostUSD: number;
} {
  resetIfNewDay();

  const dataTransferGB = costData.dataTransferBytes / (1024 * 1024 * 1024);

  // API 호출 비용
  const estimatedApiCostUSD = (costData.apiCalls / 1000) * API_COST_PER_1000;

  // 데이터 전송 비용 (100GB 초과분만)
  // 참고: 이건 일일 기준이라 월간 누적과 다를 수 있음
  const estimatedTransferCostUSD =
    Math.max(0, dataTransferGB - FREE_TRANSFER_GB) * TRANSFER_COST_PER_GB;

  return {
    date: costData.date,
    apiCalls: costData.apiCalls,
    dataTransferBytes: costData.dataTransferBytes,
    dataTransferGB: Math.round(dataTransferGB * 1000) / 1000, // 소수점 3자리
    estimatedApiCostUSD: Math.round(estimatedApiCostUSD * 10000) / 10000,
    estimatedTransferCostUSD:
      Math.round(estimatedTransferCostUSD * 10000) / 10000,
    estimatedTotalCostUSD:
      Math.round((estimatedApiCostUSD + estimatedTransferCostUSD) * 10000) /
      10000,
  };
}

/**
 * 비용 데이터 리셋 (테스트용)
 */
export function resetCostData(): void {
  costData = {
    date: "",
    apiCalls: 0,
    dataTransferBytes: 0,
  };
}
