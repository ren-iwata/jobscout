// モック分析（LLMなし・決定的）: 自己テストとAPIキー無しデモ用
import type { JobAnalysis, Platform } from "../types";

const DANGER_WORDS = ["バレないように", "アカウントを貸", "無償で", "外部で直接契約", "口外禁止で先に作業"];

export function mockAnalyze(rawText: string, platformHint: Platform | null): JobAnalysis {
  const isEnglish = /^[\s\S]*?[a-zA-Z]{20}/.test(rawText) && !/[ぁ-んァ-ン]/.test(rawText);
  const platform: Platform = platformHint ?? (isEnglish ? "upwork" : "crowdworks");
  const dangerous = DANGER_WORDS.some((w) => rawText.includes(w));

  const base: JobAnalysis = {
    platform,
    title: rawText.slice(0, 24) || "無題案件",
    summary: "モック分析: 案件文の要約。",
    clientGoal: "業務の自動化・効率化（モック）",
    deliverables: ["Webツール一式", "簡易ドキュメント"],
    requiredTech: ["Next.js", "LLM API"],
    budgetText: rawText.includes("万円") ? "30万円（記載）" : "記載なし",
    contractType: "固定価格（推定）",
    deadlineText: "記載なし",
    effortDays: { min: 5, max: 8 },
    inferred: ["中小規模の事業者と推定"],
    unknowns: ["データ量", "既存システムの有無"],
    riskFlags: [],
    riskOverall: "ok",
    axes: [
      { key: "feasibility", score: 4, rationale: "既存スタックで対応可能" },
      { key: "provability", score: 4, rationale: "類似実績あり" },
      { key: "profitability", score: 3, rationale: "予算次第" },
      { key: "winnability", score: 3, rationale: "競合不明" },
      { key: "career", score: 3, rationale: "標準的" },
      { key: "clientQuality", score: 3, rationale: "情報不足" },
      { key: "certainty", score: 2, rationale: "不明点が多い" },
      { key: "applicationCost", score: 4, rationale: "軽い" },
    ],
    verdict: "APPLY_AFTER_CLARIFICATION",
    verdictReasoning: "実行可能だが不明点があるため、質問で確度を上げてから応募すべき（モック）。",
    strategy: {
      sellPoints: ["AIエージェント実装の公開実績", "本番運用経験"],
      evidenceToUse: ["agentfront", "hojincheck"],
      clientConcern: "納品まで辿り着くか",
      differentiation: "動くものをURLで示せる",
      openingDirection: "案件固有の課題理解から入る",
      avoid: ["汎用的な自己紹介から始めること"],
      priceStrategy: "日額基準×工数で正直に提示",
    },
    proposalDraft:
      platform === "upwork"
        ? "Hello — I read your posting carefully. (mock proposal draft in English)"
        : "はじめまして。ご依頼内容を拝見しました。（モック提案文）",
    clarifyingQuestions: ["データはどこにありますか？", "希望時期はいつですか？"],
    estimate: {
      options: [
        { type: "固定価格", amountText: "200,000〜320,000円", note: "工数5〜8日×日額基準" },
      ],
      basis: "日額3〜4万円×5〜8日（モック算定）",
    },
    analyzedAt: new Date().toISOString(),
  };

  if (dangerous) {
    return {
      ...base,
      riskFlags: [
        {
          flag: "規約違反・不正の示唆",
          level: "rule_violation",
          evidence: rawText.slice(0, 60),
        },
      ],
      riskOverall: "rule_violation",
      verdict: "REJECT_RISK",
      verdictReasoning: "規約違反または不正行為を示唆する文言があるため応募すべきでない（モック）。",
      proposalDraft: "",
      clarifyingQuestions: [],
    };
  }
  return base;
}
