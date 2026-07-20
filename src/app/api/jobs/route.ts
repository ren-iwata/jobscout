import { NextRequest, NextResponse } from "next/server";
import { analyzeJob } from "@/lib/analyzer/engine";
import { isAdmin } from "@/lib/auth";
import { appendEvent, listJobs, newJobId, saveJob } from "@/lib/store";
import type { JobCase, Platform } from "@/lib/types";
import { PLATFORMS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 長文案件の分析対策（Fluid Compute上限）

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jobs = await listJobs();
  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      platform: j.platform,
      status: j.status,
      title: j.analysis?.title ?? j.rawText.slice(0, 30),
      verdict: j.analysis?.verdict,
      riskOverall: j.analysis?.riskOverall,
    })),
  });
}

/** 案件文の貼り付け→分析 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    rawText?: string;
    platform?: string;
    sourceSearch?: { platform?: string; query?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ss = body.sourceSearch;
  const sourceSearch =
    ss &&
    (ss.platform === "crowdworks" || ss.platform === "upwork") &&
    typeof ss.query === "string" &&
    ss.query.trim().length > 0 &&
    ss.query.length <= 120
      ? { platform: ss.platform as "crowdworks" | "upwork", query: ss.query.trim() }
      : undefined;
  const rawText = (body.rawText ?? "").trim();
  if (!rawText) {
    return NextResponse.json({ error: "案件文が空です" }, { status: 400 });
  }
  if (rawText.length > 40000) {
    return NextResponse.json({ error: "案件文が長すぎます（4万字まで）" }, { status: 400 });
  }
  const platformHint =
    body.platform && (PLATFORMS as readonly string[]).includes(body.platform)
      ? (body.platform as Platform)
      : null;

  const now = new Date().toISOString();
  const j: JobCase = {
    id: newJobId(),
    createdAt: now,
    updatedAt: now,
    platform: platformHint ?? "other",
    rawText,
    status: "ANALYZED",
    outcome: {},
    sourceSearch,
  };
  await appendEvent(j.id, "job_created", "owner", { length: rawText.length });

  try {
    j.analysis = await analyzeJob(rawText, platformHint);
    j.platform = j.analysis.platform;
    await appendEvent(j.id, "analyzed", "agent", {
      verdict: j.analysis.verdict,
      risk: j.analysis.riskOverall,
    });
  } catch (err) {
    await appendEvent(j.id, "error", "system", { error: String(err) });
    await saveJob(j);
    return NextResponse.json(
      { error: `分析に失敗しました: ${String(err).slice(0, 200)}`, jobId: j.id },
      { status: 500 }
    );
  }
  await saveJob(j);
  return NextResponse.json({ job: j });
}
