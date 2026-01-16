/**
 * GET /api/logs/cost
 * 비용 추적 정보 조회
 */

import { NextResponse } from "next/server";
import { getCostSummary } from "@/lib/cost-tracker";

export async function GET() {
  const summary = getCostSummary();
  return NextResponse.json(summary);
}
