# CLAUDE.md — jobscout

共通規約は ~/.claude/CLAUDE.md に従う。本ファイルはプロジェクト固有事項のみ記載する。

## 固有技術規則
- スタック: Next.js 15 (App Router/TypeScript) + React 19 + Tailwind CSS v4 + Anthropic SDK直接。保存は二層（DATABASE_URL時=Postgres js_*テーブル／ローカル=data/）。
- DBは agentfront-claude と同一Supabaseに相乗り（js_プレフィックスで分離・無料枠節約）。af_テーブルには触れない。
- モデルIDは src/lib/ai/models.ts のみで定義。

## 固有の原則・禁止事項
- **自動応募ボットにしない**: 自動ログイン・スクレイピング・自動巡回・自動クリック・自動応募・自動メッセージ送信を実装しない（プラットフォーム規約・アカウント保護）。入力は人間の貼り付け、応募の実行は人間。
- 金額はAIに発明させない: 見積もりはプロフィールの単価基準×工数から算出し根拠を示す。
- 危険検出は詐欺と断定しない: 4段階（規約リスク/強い危険信号/要確認/問題なし）＋根拠提示。
- 案件データ（data/jobs等）をコミットしない。
- 自己テスト: `MOCK_MODE=1 ADMIN_PASSWORD=test-pass npm run dev` + `BASE_URL=http://localhost:3000 ADMIN_PASSWORD=test-pass npm run test:e2e`（全件PASSが完了条件）。
