import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { ensureSchema, getSql, pgEnabled } from "@/lib/db";

export const runtime = "nodejs";

/** バックグラウンドタスクのenqueue（実行はワーカー: 毎時 or kick push） */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pgEnabled()) {
    return NextResponse.json(
      { error: "ローカル（ファイル駆動）ではキューは使えません。scripts/worker/run.mjs --dry を使用" },
      { status: 400 }
    );
  }
  let body: { kind?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.kind !== "capability_scan") {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`insert into js_tasks (kind, payload)
    values (${body.kind}, ${sql.json((body.payload ?? {}) as never)}) returning id`;
  return NextResponse.json({
    taskId: Number(rows[0].id),
    note: "ワーカーが毎時実行で処理します（次の毎時17分頃）",
  });
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pgEnabled()) return NextResponse.json({ tasks: [] });
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`select id, kind, status, result, created_at, updated_at
    from js_tasks order by id desc limit 20`;
  return NextResponse.json({ tasks: rows });
}
