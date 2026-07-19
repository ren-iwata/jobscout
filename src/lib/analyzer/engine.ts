// 分析エンジン: 案件文→構造化・判定・提案の一括生成
import Anthropic from "@anthropic-ai/sdk";
import { MODELS, MAX_TOKENS, isMockMode } from "../ai/models";
import { loadProfile } from "../profile";
import type { JobAnalysis, Platform } from "../types";
import { buildAnalysisPrompt } from "./prompts";
import { JOB_ANALYSIS_TOOL } from "./schema";
import { mockAnalyze } from "./mock";

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  }
  return anthropic;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromToolInput(input: any): JobAnalysis {
  return {
    platform: input.platform,
    title: input.title,
    summary: input.summary,
    clientGoal: input.client_goal,
    deliverables: input.deliverables ?? [],
    requiredTech: input.required_tech ?? [],
    budgetText: input.budget_text ?? "記載なし",
    contractType: input.contract_type ?? "記載なし",
    deadlineText: input.deadline_text ?? "記載なし",
    effortDays: input.effort_days,
    inferred: input.inferred ?? [],
    unknowns: input.unknowns ?? [],
    riskFlags: input.risk_flags ?? [],
    riskOverall: input.risk_overall ?? "needs_check",
    axes: input.axes ?? [],
    verdict: input.verdict,
    verdictReasoning: input.verdict_reasoning ?? "",
    strategy: {
      sellPoints: input.strategy?.sell_points ?? [],
      evidenceToUse: input.strategy?.evidence_to_use ?? [],
      clientConcern: input.strategy?.client_concern ?? "",
      differentiation: input.strategy?.differentiation ?? "",
      openingDirection: input.strategy?.opening_direction ?? "",
      avoid: input.strategy?.avoid ?? [],
      priceStrategy: input.strategy?.price_strategy ?? "",
    },
    proposalDraft: (input.proposal_draft ?? "").replace(/\\n/g, "\n"),
    clarifyingQuestions: input.clarifying_questions ?? [],
    estimate: {
      options: (input.estimate?.options ?? []).map((o: any) => ({
        type: o.type,
        amountText: o.amount_text,
        note: o.note,
      })),
      basis: input.estimate?.basis ?? "",
    },
    analyzedAt: new Date().toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function analyzeJob(
  rawText: string,
  platformHint: Platform | null
): Promise<JobAnalysis> {
  if (isMockMode()) return mockAnalyze(rawText, platformHint);
  const profile = await loadProfile();
  const res = await client().messages.create({
    model: MODELS.conversation,
    max_tokens: MAX_TOKENS,
    system: buildAnalysisPrompt(profile, platformHint),
    messages: [
      {
        role: "user",
        content: `次の案件文を分析せよ。\n\n----- 案件文ここから -----\n${rawText}\n----- 案件文ここまで -----`,
      },
    ],
    tools: [JOB_ANALYSIS_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: "job_analysis" },
  });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("job_analysis tool was not called");
  }
  return fromToolInput(toolUse.input);
}
