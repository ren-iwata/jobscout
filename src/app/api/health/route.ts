import { NextResponse } from "next/server";
import { ensureSchema, getSql, pgEnabled } from "@/lib/db";
import { isMockMode } from "@/lib/ai/models";

export const runtime = "nodejs";

/** 監視・デプロイ煙テスト用。DB接続の生存確認まで行う（LLMは呼ばない） */
export async function GET() {
  const storage = pgEnabled() ? "pg" : "fs";
  let db = "n/a";
  if (pgEnabled()) {
    try {
      await ensureSchema();
      await getSql()`select 1`;
      db = "ok";
    } catch (e) {
      return NextResponse.json(
        { ok: false, storage, db: `error: ${String(e).slice(0, 200)}` },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({
    ok: true,
    storage,
    db,
    mock: isMockMode(),
    version: "js-0.1.0",
  });
}
