import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobScout — 案件獲得エージェント",
  description:
    "Upwork・クラウドワークスの案件を分析し、応募判断・提案文・見積もりを生成するオーナー専用ツール",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
