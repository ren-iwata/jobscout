import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { appendEvent, deleteJob, getJob } from "@/lib/store";

export const runtime = "nodejs";

/** 複数案件の一括削除（選択削除UI用。取り消し不可・監査イベントは残す） */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 100)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "削除対象がありません" }, { status: 400 });
  }
  let deleted = 0;
  for (const id of ids) {
    const job = await getJob(id);
    if (!job) continue;
    await appendEvent(id, "deleted", "owner", {
      status: job.status,
      head: job.rawText.slice(0, 40),
      bulk: true,
    });
    await deleteJob(id);
    deleted++;
  }
  return NextResponse.json({ ok: true, deleted });
}
