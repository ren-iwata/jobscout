# 02_architecture — v0.1 構成

スタック・CI・検収路はagentfrontで実証済みの型を全面流用: Next.js 15 (App Router/TS) + React 19 + Tailwind v4 + Anthropic SDK直接（claude-sonnet-5・models.ts集約）+ 二層ストレージ（Postgres js_* / ファイル）+ Vercel(hnd1・CIデプロイ一本化) + GitHub Actions（E2E→provision→deploy→smoke→ci-status書き戻し）。

- オーナー専用ツール: 公開ページなし。全画面ADMIN_PASSWORD+署名cookie。
- DB: agentfront-claudeと同一Supabaseに js_ プレフィックスで相乗り（無料枠2プロジェクト制限の回避。provisionがagentfront-claudeのDATABASE_URLを読んで共用）。
- 分析は1回のLLM呼び出し（job_analysisツール強制・8192tokens）で構造化〜提案まで一括生成。モック分析同梱でE2E決定的。
- 画面: /（一覧+簡易集計）・/new（貼り付け）・/jobs/[id]（分析結果・提案編集・結果記録）・/profile（JSONエディタ）・/login。
