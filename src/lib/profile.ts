// 利用者プロフィール（Freelancer Profile Model）
// 保存はKV（key="profile"）。未設定時は既定値（実在の実績で初期化済み）。
import type { FreelancerProfile } from "./types";
import { kvGet, kvSet } from "./store";

export const DEFAULT_PROFILE: FreelancerProfile = {
  name: "Ren Iwata",
  languages: ["日本語（ネイティブ）", "英語（読み書き可・会話は簡易）"],
  country: "日本",
  timezone: "Asia/Tokyo (UTC+9)",
  hoursPerWeek: 30,
  dayRateJpyRange: [30000, 60000],
  minProjectJpy: 100000,
  contractForms: ["固定価格", "マイルストーン分割"],
  englishLevel: "読み書き中心（提案文・技術文書は可。音声面談は日本語希望）",
  interviewOk: true,
  longTermOk: true,
  skills: {
    "AI・エージェント": [
      "Claude API（tool use・構造化出力）",
      "AIエージェント設計（状態機械・人間承認ゲート・監査ログ)",
      "MCPサーバー開発",
      "プロンプト設計",
    ],
    Web: ["Next.js 15 / React 19 / TypeScript", "Tailwind CSS", "REST API設計"],
    "インフラ・DB": [
      "Vercel / Cloudflare Workers",
      "Supabase / PostgreSQL",
      "GitHub Actions CI/CD",
    ],
    モバイル: ["React Native (Expo)", "Firebase"],
    自動化: ["外部API統合", "業務フロー自動化", "公的データの取得・正規化"],
  },
  evidence: [
    {
      id: "agentfront",
      name: "AgentFront",
      type: "公開Webサービス（稼働中）",
      url: "https://agentfront-claude.vercel.app",
      summary:
        "AI受注フロントエージェント。相談受付〜ヒアリング〜提案〜受注〜納品完了まで、AIが一次対応し人間が承認する構造で完結。企画から本番公開まで1日で単独構築",
      capabilities: [
        "LLMエージェント（12状態機械・人間承認ゲート8項目・監査ログ）",
        "Next.js+Supabase本番運用",
        "CI/CD自動デプロイ",
      ],
    },
    {
      id: "hojincheck",
      name: "HojinCheck",
      type: "検証API / MCPサーバー（本番URL稼働）",
      summary:
        "日本法人の実在検証サービス。公的データを取得・正規化し、RESTとMCPの両方で公開。APIキー発行・レート制限・使用量計測・英日ドキュメントまで実装",
      capabilities: [
        "外部公的データの取得・正規化",
        "REST / MCP 二面公開",
        "認証・レート制限・使用量計測",
      ],
    },
    {
      id: "loop",
      name: "loop",
      type: "公開Webサービス（稼働中）",
      url: "https://loop-delta-nine.vercel.app",
      summary:
        "AIとの会話がそのまま記事になる制作環境。Next.js 15 + Supabase + Anthropic SDK。認証（Magic Link）・本番データ移行まで単独実施",
      capabilities: ["LLMストリーミング", "認証", "本番データ移行"],
    },
    {
      id: "futsal-app",
      name: "グループイベント幹事アプリ（開発中）",
      type: "モバイルアプリ（iOS/Android）",
      summary:
        "React Native (Expo) + Firebase の招待制グループ運営アプリ。法規制を踏まえた金銭非保持設計",
      capabilities: ["クロスプラットフォーム", "プッシュ通知", "法規制配慮設計"],
    },
  ],
  strategy: {
    want: [
      "AIエージェント・チャットボット構築",
      "LLM組み込み（API連携・業務自動化）",
      "MCPサーバー・API開発",
      "小〜中規模のWebアプリ新規構築",
    ],
    avoid: [
      "大規模SIの保守・常駐",
      "デザインのみの案件",
      "既存の巨大コードベースの部分改修のみ",
    ],
    learningOk: ["新しいAIツール・フレームワークの検証案件（低単価でも可）"],
    longTermGoal:
      "AIネイティブな受託の実績を蓄積し、自社プロダクト（AIエージェント基盤）へ接続する",
  },
  boundaries: {
    notOffered: [
      "規約違反となるスクレイピング・自動操作",
      "ユーザー資金の保持・移動を伴う決済実装",
      "アカウント貸与・なりすまし",
    ],
  },
};

export async function loadProfile(): Promise<FreelancerProfile> {
  const saved = await kvGet<FreelancerProfile>("profile");
  return saved ? { ...DEFAULT_PROFILE, ...saved } : DEFAULT_PROFILE;
}

export async function saveProfile(p: FreelancerProfile): Promise<void> {
  await kvSet("profile", p);
}

/** プロンプト用の要約テキスト */
export function profileForPrompt(p: FreelancerProfile): string {
  const skills = Object.entries(p.skills)
    .map(([k, v]) => `${k}: ${v.join("、")}`)
    .join("\n");
  const ev = p.evidence
    .map(
      (e) =>
        `- [${e.id}] ${e.name}（${e.type}${e.url ? `・${e.url}` : ""}）: ${e.summary} / 実証: ${e.capabilities.join("、")}`
    )
    .join("\n");
  return [
    `名前: ${p.name} ／ 拠点: ${p.country}（${p.timezone}）／ 稼働: 週${p.hoursPerWeek}時間`,
    `言語: ${p.languages.join("、")} ／ 英語力: ${p.englishLevel}`,
    `単価基準: 日額${p.dayRateJpyRange[0].toLocaleString()}〜${p.dayRateJpyRange[1].toLocaleString()}円 ／ 最低受注額${p.minProjectJpy.toLocaleString()}円`,
    `契約形態: ${p.contractForms.join("、")} ／ 面談: ${p.interviewOk ? "可" : "不可"} ／ 長期: ${p.longTermOk ? "可" : "不可"}`,
    `技術:\n${skills}`,
    `実績（証拠）:\n${ev}`,
    `戦略: 取りたい=${p.strategy.want.join("、")} ／ 避ける=${p.strategy.avoid.join("、")} ／ 学習目的可=${p.strategy.learningOk.join("、")}`,
    `長期目標: ${p.strategy.longTermGoal}`,
    `受けない仕事: ${p.boundaries.notOffered.join("、")}`,
  ].join("\n");
}
