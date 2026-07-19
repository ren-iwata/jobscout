import { NextRequest, NextResponse } from "next/server";
import { analyzeJob } from "@/lib/analyzer/engine";
import { isAdmin } from "@/lib/auth";
import { appendEvent, getJob, readEvents, saveJob } from "@/lib/store";
import type { JobOutcome, JobStatus } from "@/lib/types";
import { JOB_STATUSES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  const events = await readEvents(id);
  return NextResponse.json({ job, events });
}

/** ステータス・結果記録・提案文編集の更新 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: {
    status?: string;
    outcome?: Partial<JobOutcome>;
    proposalDraft?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const updated: string[] = [];
  if (body.status) {
    if (!(JOB_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "unknown status" }, { status: 400 });
    }
    const prev = job.status;
    job.status = body.status as JobStatus;
    if (body.status === "APPLIED" && !job.outcome.appliedAt) {
      job.outcome.appliedAt = new Date().toISOString();
    }
    // 採用時: 開発側（開発部）へ渡す作業契約を自動生成（agentfrontのWork Contractと同型思想）
    if (body.status === "WON" && !job.workContract) {
      const a = job.analysis;
      job.workContract = {
        source: "jobscout",
        jobId: job.id,
        platform: job.platform,
        createdAt: new Date().toISOString(),
        title: a?.title ?? job.rawText.slice(0, 40),
        objective: a?.clientGoal ?? "",
        deliverables: a?.deliverables ?? [],
        requiredTech: a?.requiredTech ?? [],
        unknownsAtContract: a?.unknowns ?? [],
        contractAmount: body.outcome?.contractAmount ?? job.outcome.contractAmount ?? "（未記入）",
        deadlineText: a?.deadlineText ?? "（未記入）",
        proposalUsed: job.outcome.proposalUsed ?? a?.proposalDraft ?? "",
        clientThread: (job.thread ?? []).slice(-20),
        rawJobText: job.rawText,
      };
      await appendEvent(id, "contract_generated", "system", {});
    }
    await appendEvent(id, "status_change", "owner", { from: prev, to: job.status });
    updated.push("status");
  }
  if (body.outcome) {
    job.outcome = { ...job.outcome, ...body.outcome };
    await appendEvent(id, "outcome_update", "owner", { keys: Object.keys(body.outcome) });
    updated.push("outcome");
  }
  if (body.proposalDraft !== undefined && job.analysis) {
    job.analysis.proposalDraft = body.proposalDraft;
    await appendEvent(id, "proposal_edited", "owner", {});
    updated.push("proposalDraft");
  }
  if (updated.length === 0) {
    return NextResponse.json({ error: "no updates" }, { status: 400 });
  }
  await saveJob(job);
  return NextResponse.json({ job });
}

/** 再分析（プロフィール更新後などに使用） */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const first = !job.analysis;
    job.analysis = await analyzeJob(job.rawText, job.platform === "other" ? null : job.platform);
    job.platform = job.analysis.platform;
    if (job.status === "SCREENED") job.status = "ANALYZED";
    await appendEvent(id, first ? "analyzed" : "reanalyzed", "agent", {
      verdict: job.analysis.verdict,
    });
    await saveJob(job);
    return NextResponse.json({ job });
  } catch (err) {
    await appendEvent(id, "error", "system", { error: String(err) });
    return NextResponse.json(
      { error: `再分析に失敗しました: ${String(err).slice(0, 200)}` },
      { status: 500 }
    );
  }
}
