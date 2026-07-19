import { NextRequest, NextResponse } from "next/server";
import { draftReply } from "@/lib/analyzer/reply";
import { isAdmin } from "@/lib/auth";
import { appendEvent, getJob, saveJob } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** クライアントメッセージの貼り付け→返信案生成（送信はしない） */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: { clientMessage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const msg = (body.clientMessage ?? "").trim();
  if (!msg) return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });

  try {
    const now = new Date().toISOString();
    job.thread = job.thread ?? [];
    job.thread.push({ who: "client", text: msg, at: now });
    const draft = await draftReply(job, msg);
    job.thread.push({ who: "me_draft", text: draft, at: new Date().toISOString() });
    if (job.status === "APPLIED") job.status = "REPLIED";
    if (!job.outcome.replied) job.outcome.replied = true;
    await appendEvent(id, "reply_drafted", "agent", { clientLen: msg.length });
    await saveJob(job);
    return NextResponse.json({ job, draft });
  } catch (err) {
    return NextResponse.json(
      { error: `返信案の生成に失敗しました: ${String(err).slice(0, 200)}` },
      { status: 500 }
    );
  }
}
