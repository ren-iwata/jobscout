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
  // 文脈の組み立て: 実際に送った提案文（編集後）を優先し、確認質問・見積もり根拠も渡す
  const a = job.analysis;
  const proposalSent = (job.outcome.proposalUsed ?? a?.proposalDraft ?? "").slice(0, 2500);
  const questions =
    a?.clarifyingQuestions?.length
      ? `\n# こちらが提示済みの確認質問（先方の返信はこれへの回答である可能性が高い。回答された項目を認識し、未回答の項目があれば自然に再確認する）\n${a.clarifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";
  const estimate =
    a?.estimate
      ? `\n# 見積もりの内部方針（先方に新たな金額を確約しないこと。既提示額の範囲でのみ言及可）\n${a.estimate.options.map((o) => `${o.type}: ${o.amountText}`).join(" / ")}\n根拠: ${a.estimate.basis.slice(0, 300)}`
      : "";
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
${a ? `${a.title}: ${a.summary}` : job.rawText.slice(0, 800)}

# 送付済みの提案文（先方はこれを読んで返信している）
${proposalSent || "（未送付）"}
${questions}${estimate}

# これまでのやり取り
${thread || "（初回）"}`,
    messages: [{ role: "user", content: `クライアントからのメッセージ:\n${clientMessage}\n\n返信案を作成せよ。` }],
  });
  const text = res.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : "";
}
