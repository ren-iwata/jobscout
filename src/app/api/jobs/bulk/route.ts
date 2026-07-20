import { NextRequest, NextResponse } from "next/server";
import { screenBulk } from "@/lib/analyzer/screen";
import { isAdmin } from "@/lib/auth";
import { appendEvent, newJobId, saveJob } from "@/lib/store";
import type { JobCase } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 長文案件の分析対策（Fluid Compute上限）

/** 一括取り込み: 検索結果ページの貼り付け→分割→軽量スクリーニング→SCREENED案件を一括作成
 *  フル分析はここでは行わない（時間制限とコスト制御のため。クライアント側が上位から順次実行する） */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { rawText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const rawText = (body.rawText ?? "").trim();
  if (!rawText) return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
  if (rawText.length > 100000) {
    return NextResponse.json({ error: "テキストが長すぎます（10万字まで）" }, { status: 400 });
  }

  let items;
  try {
    items = await screenBulk(rawText);
  } catch (err) {
    return NextResponse.json(
      { error: `選別に失敗しました: ${String(err).slice(0, 200)}` },
      { status: 500 }
    );
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "案件を検出できませんでした" }, { status: 422 });
  }

  const created: JobCase[] = [];
  const now = new Date().toISOString();
  for (const it of items) {
    const j: JobCase = {
      id: newJobId(),
      createdAt: now,
      updatedAt: now,
      platform: it.platformGuess,
      rawText: it.rawExcerpt,
      status: "SCREENED",
      quickScore: it.quickScore,
      screenReason: it.reason,
      outcome: {},
    };
    await saveJob(j);
    await appendEvent(j.id, "screened", "agent", {
      quickScore: it.quickScore,
      worthFullAnalysis: it.worthFullAnalysis,
    });
    created.push(j);
  }
  created.sort((a, b) => (b.quickScore ?? 0) - (a.quickScore ?? 0));
  return NextResponse.json({
    jobs: created.map((j) => ({
      id: j.id,
      title: j.rawText.slice(0, 40),
      quickScore: j.quickScore,
      screenReason: j.screenReason,
      platform: j.platform,
    })),
    // クライアント側はこの順で /api/jobs/[id] POST（フル分析）を叩く
    recommendFullAnalysis: created
      .filter((j) => (j.quickScore ?? 0) >= 6)
      .slice(0, 5)
      .map((j) => j.id),
  });
}
