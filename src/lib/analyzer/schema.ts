// LLMに強制するツールスキーマ（分析一式を1回で出力）
import { PLATFORMS, RISK_LEVELS, VERDICTS } from "../types";

export const JOB_ANALYSIS_TOOL = {
  name: "job_analysis",
  description:
    "案件文の構造化・危険検出・応募判断・提案生成を1回で出力する。必ずこのツールを使う。",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      platform: { type: "string", enum: PLATFORMS },
      title: { type: "string", description: "案件の短いタイトル" },
      summary: { type: "string", description: "案件の2-3文要約（日本語）" },
      client_goal: { type: "string", description: "発注者の目的（日本語）" },
      deliverables: { type: "array", items: { type: "string" } },
      required_tech: { type: "array", items: { type: "string" } },
      budget_text: { type: "string", description: "記載の予算。なければ「記載なし」" },
      contract_type: { type: "string", description: "固定/時給等。なければ「記載なし」" },
      deadline_text: { type: "string", description: "納期。なければ「記載なし」" },
      effort_days: {
        type: "object",
        properties: { min: { type: "number" }, max: { type: "number" } },
      },
      inferred: {
        type: "array",
        items: { type: "string" },
        description: "文脈から推定した事項（推測で確定しない）",
      },
      unknowns: {
        type: "array",
        items: { type: "string" },
        description: "案件文に無く、確認が必要な事項",
      },
      risk_flags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            flag: { type: "string" },
            level: {
              type: "string",
              enum: ["rule_violation", "strong_warning", "needs_check"],
            },
            evidence: { type: "string", description: "案件文中の根拠" },
          },
          required: ["flag", "level", "evidence"],
        },
      },
      risk_overall: { type: "string", enum: RISK_LEVELS },
      axes: {
        type: "array",
        description: "8軸すべてを評価する",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              enum: [
                "feasibility",
                "provability",
                "profitability",
                "winnability",
                "career",
                "clientQuality",
                "certainty",
                "applicationCost",
              ],
            },
            score: { type: "number", minimum: 1, maximum: 5 },
            rationale: { type: "string" },
          },
          required: ["key", "score", "rationale"],
        },
      },
      verdict: { type: "string", enum: VERDICTS },
      verdict_reasoning: { type: "string" },
      strategy: {
        type: "object",
        properties: {
          sell_points: { type: "array", items: { type: "string" } },
          evidence_to_use: { type: "array", items: { type: "string" } },
          client_concern: { type: "string" },
          differentiation: { type: "string" },
          opening_direction: { type: "string" },
          avoid: { type: "array", items: { type: "string" } },
          price_strategy: { type: "string" },
        },
        required: [
          "sell_points",
          "evidence_to_use",
          "client_concern",
          "differentiation",
          "opening_direction",
          "avoid",
          "price_strategy",
        ],
      },
      proposal_draft: {
        type: "string",
        description:
          "顧客へ送る提案文。Upworkは英語、クラウドワークスは日本語（翻訳ではなく各文化の慣習で書き下ろす）",
      },
      clarifying_questions: { type: "array", items: { type: "string" } },
      estimate: {
        type: "object",
        properties: {
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                amount_text: { type: "string" },
                note: { type: "string" },
              },
              required: ["type", "amount_text", "note"],
            },
          },
          basis: { type: "string", description: "単価基準×工数の算定根拠" },
        },
        required: ["options", "basis"],
      },
    },
    required: [
      "platform",
      "title",
      "summary",
      "client_goal",
      "deliverables",
      "required_tech",
      "budget_text",
      "contract_type",
      "deadline_text",
      "inferred",
      "unknowns",
      "risk_flags",
      "risk_overall",
      "axes",
      "verdict",
      "verdict_reasoning",
      "strategy",
      "proposal_draft",
      "clarifying_questions",
      "estimate",
    ],
  },
};
