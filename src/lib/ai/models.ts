// モデルIDは本ファイルに集約する（横断技術ノート: 差し替えを1行で済ませる）
// 社内実績（loop）と同系: 会話系=Sonnet。提案生成も v0.1 は Sonnet（コスト優先）。
export const MODELS = {
  conversation: process.env.AF_MODEL_CONVERSATION || "claude-sonnet-5",
  proposal: process.env.AF_MODEL_PROPOSAL || "claude-sonnet-5",
} as const;

export const MAX_TOKENS = 8192;

/** モックモード判定: 明示指定 or APIキー不在 */
export function isMockMode(): boolean {
  if (process.env.MOCK_MODE === "1") return true;
  if (!process.env.ANTHROPIC_API_KEY) return true;
  return false;
}
