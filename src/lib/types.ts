// JobScout v0.1 — ドメイン型定義
// 正: docs/04_data_model.md

export const PLATFORMS = ["upwork", "crowdworks", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  upwork: "Upwork",
  crowdworks: "クラウドワークス",
  other: "その他",
};

/** 応募判断（6分類） */
export const VERDICTS = [
  "APPLY_NOW",
  "APPLY_AFTER_CLARIFICATION",
  "APPLY_AS_DISCOVERY",
  "WATCH",
  "SKIP",
  "REJECT_RISK",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  APPLY_NOW: "即応募",
  APPLY_AFTER_CLARIFICATION: "質問後に応募",
  APPLY_AS_DISCOVERY: "探索目的で応募",
  WATCH: "様子見",
  SKIP: "見送り",
  REJECT_RISK: "危険・拒否",
};

/** 危険度（詐欺と断定せず段階で示す） */
export const RISK_LEVELS = [
  "rule_violation",
  "strong_warning",
  "needs_check",
  "ok",
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LABELS: Record<RiskLevel, string> = {
  rule_violation: "明確な規約リスク",
  strong_warning: "強い危険信号",
  needs_check: "要確認",
  ok: "問題なし",
};

/** 案件の追跡ステータス（人間が記録する） */
export const JOB_STATUSES = [
  "SCREENED",
  "ANALYZED",
  "APPLIED",
  "REPLIED",
  "INTERVIEW",
  "WON",
  "LOST",
  "ARCHIVED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<JobStatus, string> = {
  SCREENED: "選別済み（未精査）",
  ANALYZED: "分析済み",
  APPLIED: "応募済み",
  REPLIED: "返信あり",
  INTERVIEW: "面談",
  WON: "採用",
  LOST: "不採用",
  ARCHIVED: "見送り・保管",
};

/** 判定8軸 */
export const AXES = [
  { key: "feasibility", label: "実行可能性" },
  { key: "provability", label: "証明可能性" },
  { key: "profitability", label: "収益性" },
  { key: "winnability", label: "獲得可能性" },
  { key: "career", label: "キャリア価値" },
  { key: "clientQuality", label: "顧客品質" },
  { key: "certainty", label: "確実性（曖昧さの低さ）" },
  { key: "applicationCost", label: "応募コストの軽さ" },
] as const;

export interface AxisScore {
  key: string;
  score: number; // 1-5
  rationale: string;
}

export interface RiskFlag {
  flag: string;
  level: Exclude<RiskLevel, "ok">;
  evidence: string; // 案件文中の根拠
}

export interface EstimateOption {
  type: string; // 固定価格 / 時間単価 / マイルストーン / 初期調査+本実装 等
  amountText: string;
  note: string;
}

/** LLMが生成する分析結果一式 */
export interface JobAnalysis {
  platform: Platform;
  title: string;
  summary: string;
  clientGoal: string;
  deliverables: string[];
  requiredTech: string[];
  budgetText: string; // 記載がなければ「記載なし」
  contractType: string;
  deadlineText: string;
  effortDays?: { min: number; max: number };
  inferred: string[]; // 文脈からの推定（推測で確定しない）
  unknowns: string[]; // 確認が必要な事項
  riskFlags: RiskFlag[];
  riskOverall: RiskLevel;
  axes: AxisScore[];
  verdict: Verdict;
  verdictReasoning: string;
  strategy: {
    sellPoints: string[];
    evidenceToUse: string[]; // プロフィールevidenceのidまたは名称
    clientConcern: string;
    differentiation: string;
    openingDirection: string;
    avoid: string[];
    priceStrategy: string;
  };
  proposalDraft: string; // Upwork=英語 / クラウドワークス=日本語
  clarifyingQuestions: string[];
  estimate: { options: EstimateOption[]; basis: string };
  analyzedAt: string;
}

/** 応募結果の記録（結果学習の器・人間が入力） */
export interface JobOutcome {
  appliedAt?: string;
  priceOffered?: string;
  proposalUsed?: string; // 実際に送った提案文（編集後）
  replied?: boolean;
  interviewed?: boolean;
  result?: "won" | "lost" | "none";
  resultNote?: string; // 不採用理由・顧客の質問など
  contractAmount?: string;
  actualEffortDays?: number;
  profitNote?: string;
  satisfaction?: number; // 1-5
  portfolioValue?: number; // 1-5
  notes?: string;
}

export interface ThreadMsg {
  who: "client" | "me_draft";
  text: string;
  at: string;
}

export interface JobCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  platform: Platform;
  rawText: string; // 貼り付けられた案件文（原文保持）
  status: JobStatus;
  quickScore?: number; // 一括取り込み時の軽量スコア(1-10)
  screenReason?: string;
  analysis?: JobAnalysis;
  outcome: JobOutcome;
  jobUrl?: string; // プラットフォーム上の案件ページURL（原文から自動抽出 or 人間が貼る）
  sourceSearch?: { platform: "crowdworks" | "upwork"; query: string }; // 取り込み元の検索（検索ページへ戻るため）
  thread?: ThreadMsg[]; // クライアント対応（貼り付け→返信案）
  workContract?: Record<string, unknown>; // WON時に自動生成
}

// ---- 監査ログ ----

export type EventType =
  | "bulk_ingest"
  | "screened"
  | "reply_drafted"
  | "contract_generated"
  | "job_created"
  | "analyzed"
  | "reanalyzed"
  | "status_change"
  | "outcome_update"
  | "proposal_edited"
  | "joburl_set"
  | "deleted"
  | "profile_update"
  | "error";

export interface AuditEvent {
  at: string;
  type: EventType;
  actor: "owner" | "agent" | "system";
  data?: unknown;
}

// ---- 利用者プロフィール（Freelancer Profile Model） ----
// agentfrontの能力証拠と同型のevidenceを持ち、将来統合できる形にしている

export interface EvidenceItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  summary: string;
  capabilities: string[];
}

export interface FreelancerProfile {
  name: string;
  languages: string[];
  country: string;
  timezone: string;
  hoursPerWeek: number;
  dayRateJpyRange: [number, number];
  minProjectJpy: number;
  contractForms: string[];
  englishLevel: string;
  interviewOk: boolean;
  longTermOk: boolean;
  skills: Record<string, string[]>; // カテゴリ→技術
  evidence: EvidenceItem[];
  strategy: {
    want: string[];
    avoid: string[];
    learningOk: string[];
    longTermGoal: string;
  };
  boundaries: {
    notOffered: string[];
  };
}
