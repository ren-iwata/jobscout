// クライアント対応ドラフター: 先方メッセージの貼り付け→返信案の生成
// 送信は行わない（人間がプラットフォーム上でコピペ送信する）
import Anthropic from "@anthropic-ai/sdk";
import { MODELS, isMockMode } from "../ai/models";
import { loadProfile, profileForPrompt } from "../profile";
import type { JobCase } from "../types";

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  return anthropic;
}

export async function draftReply(job: JobCase, clientMessage: string): Promise<string> {
  if (isMockMode()) {
    return job.platform === "upwork"
      ? "Thank you for your message. (mock reply draft)"
      : "ご連絡ありがとうございます。（モック返信案）";
  }
  const profile = await loadProfile();
  const thread = (job.thread ?? [])
    .slice(-10)
    .map((m) => `${m.who === "client" ? "クライアント" : "自分(下書き)"}: ${m.text}`)
    .join("\n---\n");
  const res = await client().messages.create({
    model: MODELS.conversation,
    max_tokens: 2048,
    system: `あなたはフリーランサーのクライアント対応を支援するドラフターである。クライアントからのメッセージに対する返信案を作成する。
- 言語: ${job.platform === "upwork" ? "英語（簡潔・成果物ベース）" : "日本語（丁寧・日本の取引文脈）"}
- 価格・納期・スコープの新たな確約はしない（変更が要求されたら「検討して回答する」と受け、本文の後に日本語で【要判断】として利用者への注意を1行添える）
- 返信文のみを出力する（説明・前置き不要。【要判断】がある場合のみ末尾に付す）

# 利用者プロフィール
${profileForPrompt(profile)}

# 案件の文脈
${job.analysis ? `${job.analysis.title}: ${job.analysis.summary}\n提案済み内容: ${job.analysis.proposalDraft.slice(0, 800)}` : job.rawText.slice(0, 800)}

# これまでのやり取り
${thread || "（初回）"}`,
    messages: [{ role: "user", content: `クライアントからのメッセージ:\n${clientMessage}\n\n返信案を作成せよ。` }],
  });
  const text = res.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : "";
}
