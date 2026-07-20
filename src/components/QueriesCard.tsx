"use client";

// 「今日の検索」カード: 能力レジストリから導出された検索クエリを表示・コピー
import { useEffect, useState } from "react";
import { rememberSearch, searchUrl } from "@/lib/searchUrl";

interface Registry {
  searchQueries: { crowdworks: string[]; upwork: string[] } | null;
  fitJobTypes: string[];
  evidenceCount: number;
  updatedAt: string | null;
}

function Q({ text, platform }: { text: string; platform: "crowdworks" | "upwork" }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        className="af-chip bg-white border border-neutral-200 hover:border-blue-400 cursor-pointer"
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        title="タップでコピー"
      >
        {copied ? "コピーしました ✓" : text}
      </button>
      <a
        href={searchUrl(platform, text)}
        target="_blank"
        rel="noreferrer"
        className="af-chip bg-blue-50 text-blue-700 hover:bg-blue-100"
        title="この検索を開く"
        onClick={() => rememberSearch(platform, text)}
      >
        ↗
      </a>
    </span>
  );
}

export default function QueriesCard() {
  const [reg, setReg] = useState<Registry | null>(null);

  useEffect(() => {
    fetch("/api/registry", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReg(d.registry))
      .catch(() => null);
  }, []);

  if (!reg?.searchQueries) return null;

  return (
    <section className="af-card mb-6 p-4">
      <p className="mb-2 text-sm font-bold">
        🔍 今日の検索（成果物分析から自動導出・タップでコピー）
      </p>
      <div className="space-y-2">
        <div>
          <span className="af-label">クラウドワークス</span>
          <div className="flex flex-wrap gap-1.5">
            {reg.searchQueries.crowdworks.map((q) => (
              <Q key={q} text={q} platform="crowdworks" />
            ))}
          </div>
        </div>
        <div>
          <span className="af-label">Upwork</span>
          <div className="flex flex-wrap gap-1.5">
            {reg.searchQueries.upwork.map((q) => (
              <Q key={q} text={q} platform="upwork" />
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        検証済み実績 {reg.evidenceCount}件から導出 ・ チップ=コピー ／ ↗=検索を開く（CW: 募集終了除外・新着順 / Upwork: 新着順・支払確認済み・提案10件未満）→結果を丸ごとコピー→「一括」へ
      </p>
    </section>
  );
}
