import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { kvGet } from "@/lib/store";

export const runtime = "nodejs";

/** 能力レジストリの閲覧（検索クエリ・適合案件タイプ等） */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const reg = await kvGet<Record<string, unknown>>("capability_registry");
  if (!reg) {
    return NextResponse.json({
      registry: null,
      note: "未生成。/profile の「成果物から自動更新」を実行してください",
    });
  }
  return NextResponse.json({
    registry: {
      searchQueries: reg.searchQueries ?? null,
      fitJobTypes: reg.fitJobTypes ?? [],
      notes: reg.notes ?? "",
      evidenceCount: Array.isArray(reg.evidence) ? reg.evidence.length : 0,
      updatedAt: reg.updatedAt ?? null,
    },
  });
}
