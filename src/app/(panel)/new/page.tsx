"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewJobPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [platform, setPlatform] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rawText.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, platform: platform || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "分析に失敗しました");
      router.push(`/jobs/${data.job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析に失敗しました");
      setSending(false);
    }
  }

  return (
    <main className="space-y-4">
      <h1 className="text-lg font-bold">案件を分析する</h1>
      <div className="af-card p-5 space-y-3">
        <div>
          <label className="af-label">
            案件文を丸ごと貼り付け（タイトル・本文・予算・発注者情報など、見えているものすべて）
          </label>
          <textarea
            className="af-input min-h-64 text-sm"
            placeholder="Upwork / クラウドワークスの案件ページからコピーして貼り付け"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            maxLength={40000}
          />
        </div>
        <div>
          <label className="af-label">プラットフォーム（省略時は自動判定）</label>
          <select
            className="af-input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">自動判定</option>
            <option value="upwork">Upwork</option>
            <option value="crowdworks">クラウドワークス</option>
            <option value="other">その他</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="af-btn-primary w-full"
          onClick={submit}
          disabled={!rawText.trim() || sending}
        >
          {sending ? "分析中…（10〜30秒）" : "分析する"}
        </button>
        <p className="text-xs text-neutral-400">
          応募は自動化しません。分析・提案文の生成までを行い、応募の実行はあなたがプラットフォーム上で行います（規約遵守・アカウント保護のため）。
        </p>
      </div>
    </main>
  );
}
