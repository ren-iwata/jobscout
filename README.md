# JobScout v0.1

Upwork・クラウドワークスの案件文を貼り付けると、構造化・危険検出・応募判断（6分類×8軸）・提案戦略・提案文（英/日）・確認質問・見積もり候補を一括生成し、応募結果を記録するオーナー専用ツール。

- 自動応募はしない（分析まで。応募の実行は人間がプラットフォーム上で行う）
- 金額はプロフィールの単価基準から算出（AIに発明させない）
- 結果記録が溜まれば市場価値の実測データになる

## 起動

```bash
npm install
cp .env.example .env.local   # ADMIN_PASSWORD必須。ANTHROPIC_API_KEY無しならモック動作
npm run dev                  # http://localhost:3000
```

仕様の正は docs/、進捗の正は PROGRESS.md。
