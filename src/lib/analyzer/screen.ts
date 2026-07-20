// 一括取り込み: 検索結果ページの貼り付けテキストを案件ごとに分割し軽量スクリーニングする
import Anthropic from "@anthropic-ai/sdk";
import { MODELS, isMockMode } from "../ai/models";
import { loadProfile } from "../profile";
import { profileForPrompt } from "../profile";
import type { Platform } from "../types";
import { PLATFORMS } from "../types";

export interface ScreenedItem {
  title: string;
  rawExcerpt: string;
  platformGuess: Platform;
  quickScore: number; // 1-10
  worthFullAnalysis: boolean;
  isJobPosting: boolean; // 具体的な仕事の募集か（運営のお知らせ・広告・登録通知等はfalse→登録しない）
  reason: string;
}

const SCREEN_TOOL = {
  name: "screen_jobs",
  description: "貼り付けテキストを案件ごとに分割し、それぞれを軽量評価する。必ずこのツールを使う。",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      jobs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            raw_excerpt: {
              type: "string",
              description: "その案件に該当する貼り付けテキストの部分（原文のまま・省略可の範囲で要約しない）",
            },
            platform_guess: { type: "string", enum: PLATFORMS },
            quick_score: { type: "number", minimum: 1, maximum: 10 },
            worth_full_analysis: { type: "boolean" },
            is_job_posting: {
              type: "boolean",
              description:
                "具体的な仕事の募集（発注者が作業を依頼する内容）であればtrue。プラットフォーム運営からのお知らせ・広告・メールマガジン・登録完了通知・相場紹介・利用ガイド・サービス案内・アンケート等はfalse",
            },
            reason: { type: "string", description: "スコアの理由を1文で" },
          },
          required: [
            "title",
            "raw_excerpt",
            "platform_guess",
            "quick_score",
            "worth_full_analysis",
            "is_job_posting",
            "reason",
          ],
        },
      },
    },
    required: ["jobs"],
  },
};

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  return anthropic;
}

function mockScreen(rawText: string): ScreenedItem[] {
  return rawText
    .split(/\n\s*\n\s*\n|={3,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 15)
    .slice(0, 20)
    .map((b) => {
      const noise = /ご登録ありがとう|メールマガジン|発注相場|お知らせ/.test(b);
      return {
        title: b.slice(0, 20),
        rawExcerpt: b,
        platformGuess: /[ぁ-んァ-ン]/.test(b) ? ("crowdworks" as const) : ("upwork" as const),
        quickScore: noise ? 1 : b.includes("AI") ? 8 : 4,
        worthFullAnalysis: !noise && b.includes("AI"),
        isJobPosting: !noise,
        reason: noise
          ? "案件募集ではない（モック）"
          : b.includes("AI")
            ? "AI関連で適合度が高い（モック）"
            : "適合度が低い（モック）",
      };
    });
}

export async function screenBulk(rawText: string): Promise<ScreenedItem[]> {
  if (isMockMode()) return mockScreen(rawText);
  const profile = await loadProfile();
  const res = await client().messages.create({
    model: MODELS.conversation,
    max_tokens: 8192,
    system: `あなたは案件選別エージェントである。貼り付けられた検索結果ページのテキストを案件ごとに分割し、利用者にとっての価値を1-10で軽量採点する。
採点基準: 利用者の技術・実績との適合、予算と単価基準の整合、戦略（取りたい/避けたい）との一致、危険の気配（規約違反示唆・極端な低予算・無償要求は減点しworth_full_analysis=false）。
7点以上または迷う場合は worth_full_analysis=true。raw_excerptは原文を保持する。
重要: 具体的な仕事の募集でないもの——運営からのお知らせ・広告・メールマガジン・登録完了通知・相場紹介・利用ガイド・サービス案内・アンケート・ナビゲーション断片——は is_job_posting=false とせよ（これらは登録されず破棄される。判断に迷う場合のみtrueに倒す）。

# 利用者プロフィール
${profileForPrompt(profile)}`,
    messages: [{ role: "user", content: `次のテキストを分割・選別せよ。\n\n${rawText.slice(0, 60000)}` }],
    tools: [SCREEN_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: "screen_jobs" },
  });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("screen_jobs tool was not called");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const jobs = (toolUse.input as any).jobs ?? [];
  return jobs.map((j: any) => ({
    title: j.title,
    rawExcerpt: j.raw_excerpt,
    platformGuess: j.platform_guess,
    quickScore: j.quick_score,
    worthFullAnalysis: j.worth_full_analysis,
    isJobPosting: j.is_job_posting !== false, // 未指定はtrue側に倒す（取りこぼし防止）
    reason: j.reason,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
