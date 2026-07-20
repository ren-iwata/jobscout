"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recallSearch, type LastSearch } from "@/lib/searchUrl";

type Mode = "bulk" | "single";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `サーバー応答エラー(${res.status})。分析に時間がかかり過ぎた可能性があります。もう一度お試しください`,
    };
  }
}

export default function NewJobPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("bulk");
  const [rawText, setRawText] = useState("");
  const [platform, setPlatform] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);

  // 「今日の検索」の↗から来た場合、その検索を取り込む案件に紐付ける（案件から検索ページへ戻れる）
  useEffect(() => {
    setLastSearch(recallSearch());
  }, []);

  async function submitSingle() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          platform: platform || undefined,
          sourceSearch: lastSearch
            ? { platform: lastSearch.platform, query: lastSearch.query }
            : undefined,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? "分析に失敗しました");
      router.push(`/jobs/${data.job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析に失敗しました");
      setSending(false);
    }
  }

  async function submitBulk() {
    setSending(true);
    setError(null);
    try {
      setProgress("案件を分割・選別中…（30秒前後）");
      const res = await fetch("/api/jobs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          sourceSearch: lastSearch
            ? { platform: lastSearch.platform, query: lastSearch.query }
            : undefined,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? "選別に失敗しました");
      const ids: string[] = data.recommendFullAnalysis ?? [];
      setProgress(`${data.jobs.length}件を検出。上位${ids.length}件を精査中…`);
      for (let i = 0; i < ids.length; i++) {
        setProgress(`精査中 ${i + 1}/${ids.length} …（各10〜30秒）`);
        await fetch(`/api/jobs/${ids[i]}`, { method: "POST" }).catch(() => null);
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "一括取り込みに失敗しました");
      setSending(false);
      setProgress(null);
    }
  }

  return (
    <main className="space-y-4">
      <h1 className="text-lg font-bold">案件を取り込む</h1>
      <div className="flex gap-2">
        <button
          className={mode === "bulk" ? "af-btn-primary" : "af-btn-ghost"}
          onClick={() => setMode("bulk")}
        >
          一括（検索結果を丸ごと）
        </button>
        <button
          className={mode === "single" ? "af-btn-primary" : "af-btn-ghost"}
          onClick={() => setMode("single")}
        >
          1件ずつ
        </button>
      </div>

      {lastSearch && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          <span>
            検索元を紐付け: 「{lastSearch.query}」（
            {lastSearch.platform === "crowdworks" ? "クラウドワークス" : "Upwork"}
            ）— 取り込んだ案件から同じ検索ページへ戻れます
          </span>
          <button
            className="ml-auto shrink-0 underline"
            onClick={() => setLastSearch(null)}
          >
            外す
          </button>
        </div>
      )}

      <div className="af-card p-5 space-y-3">
        {mode === "bulk" ? (
          <div>
            <label className="af-label">
              検索結果ページの全文を貼り付け（Ctrl/Cmd+Aで全選択→コピーでOK。AIが案件ごとに分割→採点→上位だけ精査します）
            </label>
            <textarea
              className="af-input min-h-64 text-sm"
              placeholder="Upwork / クラウドワークスの検索結果ページをそのまま貼り付け"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              maxLength={100000}
            />
          </div>
        ) : (
          <>
            <div>
              <label className="af-label">案件文を貼り付け（1件）</label>
              <textarea
                className="af-input min-h-64 text-sm"
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
          </>
        )}
        {progress && <p className="text-sm text-blue-700">{progress}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="af-btn-primary w-full"
          onClick={mode === "bulk" ? submitBulk : submitSingle}
          disabled={!rawText.trim() || sending}
        >
          {sending ? "処理中…" : mode === "bulk" ? "分割・選別・精査する" : "分析する"}
        </button>
        <p className="text-xs text-neutral-400">
          応募は自動化しません。取り込み・分析・提案文生成までを行い、応募の実行はあなたがプラットフォーム上で行います。
        </p>
      </div>
    </main>
  );
}
