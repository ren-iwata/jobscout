"use client";

// 案件詳細: 分析結果の閲覧・提案文の編集・応募結果の記録
import { useCallback, useEffect, useState } from "react";
import type { JobCase } from "@/lib/types";
import {
  AXES,
  PLATFORM_LABELS,
  RISK_LABELS,
  STATUS_LABELS,
  VERDICT_LABELS,
} from "@/lib/types";

const VERDICT_BANNER: Record<string, string> = {
  APPLY_NOW: "bg-green-50 border-green-200 text-green-800",
  APPLY_AFTER_CLARIFICATION: "bg-blue-50 border-blue-200 text-blue-800",
  APPLY_AS_DISCOVERY: "bg-purple-50 border-purple-200 text-purple-800",
  WATCH: "bg-amber-50 border-amber-200 text-amber-800",
  SKIP: "bg-neutral-100 border-neutral-200 text-neutral-600",
  REJECT_RISK: "bg-red-50 border-red-200 text-red-800",
};

function Copyable({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="af-btn-ghost"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "コピーしました ✓" : label}
    </button>
  );
}

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

function extractJobUrl(rawText: string): string | null {
  const urls = rawText.match(/https?:\/\/[^\s"'<>\)\]]+/g) ?? [];
  return urls.find((u) => u.includes("upwork.com") || u.includes("crowdworks.jp")) ?? null;
}

/** URLが無い案件の代替: タイトルでプラットフォーム内検索を開く
 *  （特定案件を探す用途なので、絞り込みフィルタは付けない——付けると当の案件が除外され得る） */
function platformSearchUrl(platform: string, title: string): string {
  const q = encodeURIComponent(title.slice(0, 80));
  if (platform === "crowdworks")
    return `https://crowdworks.jp/public/jobs/search?search%5Bkeywords%5D=${q}`;
  return `https://www.upwork.com/nx/search/jobs/?q=${q}`;
}

export default function JobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<JobCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [proposal, setProposal] = useState("");
  const [outcomeBuf, setOutcomeBuf] = useState<Record<string, string>>({});
  const [clientMsg, setClientMsg] = useState("");
  const [urlBuf, setUrlBuf] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await safeJson(res);
    setJob(data.job);
    setProposal(data.job.analysis?.proposalDraft ?? "");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function showNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  }

  async function patch(body: unknown, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? "更新に失敗しました");
      await load();
      showNotice(okMsg);
    } catch (e) {
      showNotice(`⚠ ${e instanceof Error ? e.message : "更新に失敗しました"}`);
    } finally {
      setBusy(false);
    }
  }

  async function reanalyze() {
    setBusy(true);
    showNotice("再分析中…（10〜30秒）");
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "POST" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? "再分析に失敗しました");
      await load();
      showNotice("再分析しました");
    } catch (e) {
      showNotice(`⚠ ${e instanceof Error ? e.message : "再分析に失敗しました"}`);
    } finally {
      setBusy(false);
    }
  }

  if (!job) {
    return <p className="py-10 text-center text-sm text-neutral-400">読み込み中…</p>;
  }
  const a = job.analysis;

  return (
    <main className="space-y-5 pb-20">
      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}

      {/* ヘッダ・判定 */}
      <section className="af-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{a?.title ?? "（分析なし）"}</h1>
            <p className="mt-1 text-xs text-neutral-400">
              {PLATFORM_LABELS[job.platform]} ・ {job.id} ・{" "}
              {STATUS_LABELS[job.status]}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {(() => {
              const url = job.jobUrl ?? extractJobUrl(job.rawText);
              if (url)
                return (
                  <a href={url} target="_blank" rel="noreferrer" className="af-btn-ghost">
                    案件ページを開く ↗
                  </a>
                );
              if (a?.title && job.platform !== "other")
                return (
                  <a
                    href={platformSearchUrl(job.platform, a.title)}
                    target="_blank"
                    rel="noreferrer"
                    className="af-btn-ghost"
                  >
                    タイトルで検索 ↗
                  </a>
                );
              return null;
            })()}
            <button className="af-btn-primary" disabled={busy} onClick={reanalyze}>
              {a ? "再分析" : "フル分析する"}
            </button>
          </div>
        </div>
        {!(job.jobUrl ?? extractJobUrl(job.rawText)) && (
          <div className="mt-3 flex gap-2">
            <input
              className="af-input flex-1 text-xs"
              placeholder="案件ページのURLを貼ると、次回からワンクリックで開けます"
              value={urlBuf}
              onChange={(e) => setUrlBuf(e.target.value)}
            />
            <button
              className="af-btn-ghost shrink-0"
              disabled={busy || !urlBuf.trim()}
              onClick={() => patch({ jobUrl: urlBuf.trim() }, "案件URLを保存しました")}
            >
              保存
            </button>
          </div>
        )}
        {a && (
          <div
            className={`mt-3 rounded-xl border px-4 py-3 ${VERDICT_BANNER[a.verdict] ?? ""}`}
          >
            <p className="text-sm font-bold">
              判定: {VERDICT_LABELS[a.verdict]}（{a.verdict}）
            </p>
            <p className="mt-1 text-sm">{a.verdictReasoning}</p>
          </div>
        )}
        {a && a.riskOverall !== "ok" && (
          <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-bold text-red-800">
              危険度: {RISK_LABELS[a.riskOverall]}
            </p>
            <ul className="mt-1 list-disc pl-4 text-sm text-red-700">
              {a.riskFlags.map((r, i) => (
                <li key={i}>
                  {r.flag}（{RISK_LABELS[r.level]}）— 根拠: {r.evidence}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {a && (
        <>
          {/* 構造化 */}
          <section className="af-card p-5 space-y-2 text-sm">
            <h2 className="text-sm font-bold">案件の構造化</h2>
            <p>
              <span className="af-label inline mr-2">要約</span>
              {a.summary}
            </p>
            <p>
              <span className="af-label inline mr-2">発注者の目的</span>
              {a.clientGoal}
            </p>
            <p>
              <span className="af-label inline mr-2">成果物</span>
              {a.deliverables.join(" / ") || "—"}
            </p>
            <p>
              <span className="af-label inline mr-2">必要技術</span>
              {a.requiredTech.join(" / ") || "—"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <p>
                <span className="af-label">予算</span>
                {a.budgetText}
              </p>
              <p>
                <span className="af-label">契約形態</span>
                {a.contractType}
              </p>
              <p>
                <span className="af-label">納期</span>
                {a.deadlineText}
              </p>
            </div>
            {a.effortDays && (
              <p>
                <span className="af-label inline mr-2">推定工数</span>
                {a.effortDays.min}〜{a.effortDays.max}日
              </p>
            )}
            {a.inferred.length > 0 && (
              <p className="text-neutral-500">
                <span className="af-label inline mr-2">推定（未確定）</span>
                {a.inferred.join(" / ")}
              </p>
            )}
            {a.unknowns.length > 0 && (
              <p className="text-amber-700">
                <span className="af-label inline mr-2">要確認</span>
                {a.unknowns.join(" / ")}
              </p>
            )}
          </section>

          {/* 8軸 */}
          <section className="af-card p-5">
            <h2 className="mb-3 text-sm font-bold">判定8軸</h2>
            <div className="space-y-2">
              {AXES.map((ax) => {
                const s = a.axes.find((x) => x.key === ax.key);
                return (
                  <div key={ax.key} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-44 shrink-0 text-xs text-neutral-500">
                        {ax.label}
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-neutral-100">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${((s?.score ?? 0) / 5) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-bold">
                        {s?.score ?? "—"}/5
                      </span>
                    </div>
                    {s?.rationale && (
                      <p className="ml-46 pl-1 text-xs text-neutral-400">{s.rationale}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 戦略 */}
          <section className="af-card p-5 space-y-2 text-sm">
            <h2 className="text-sm font-bold">提案戦略（内部用）</h2>
            <p>
              <span className="af-label inline mr-2">売るべき能力</span>
              {a.strategy.sellPoints.join(" / ")}
            </p>
            <p>
              <span className="af-label inline mr-2">使う実績</span>
              {a.strategy.evidenceToUse.join(" / ")}
            </p>
            <p>
              <span className="af-label inline mr-2">相手の最大の懸念</span>
              {a.strategy.clientConcern}
            </p>
            <p>
              <span className="af-label inline mr-2">差別化</span>
              {a.strategy.differentiation}
            </p>
            <p>
              <span className="af-label inline mr-2">書き出しの方向</span>
              {a.strategy.openingDirection}
            </p>
            <p>
              <span className="af-label inline mr-2">避ける表現</span>
              {a.strategy.avoid.join(" / ")}
            </p>
            <p>
              <span className="af-label inline mr-2">価格戦略</span>
              {a.strategy.priceStrategy}
            </p>
          </section>

          {/* 提案文 */}
          <section className="af-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                提案文（{job.platform === "upwork" ? "英語" : "日本語"}・編集可）
              </h2>
              <Copyable label="提案文をコピー" text={proposal} />
            </div>
            <textarea
              className="af-input min-h-56 text-sm"
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
            />
            <button
              className="af-btn-ghost"
              disabled={busy}
              onClick={() => patch({ proposalDraft: proposal }, "提案文を保存しました")}
            >
              編集を保存
            </button>
          </section>

          {/* 質問・見積もり */}
          <div className="grid gap-5 md:grid-cols-2">
            <section className="af-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">契約前の確認質問</h2>
                <Copyable
                  label="コピー"
                  text={a.clarifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
                />
              </div>
              <ol className="mt-2 list-decimal pl-5 text-sm">
                {a.clarifyingQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </section>
            <section className="af-card p-5">
              <h2 className="text-sm font-bold">見積もり候補</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {a.estimate.options.map((o, i) => (
                  <li key={i}>
                    <span className="font-semibold">{o.type}:</span> {o.amountText}
                    <span className="text-neutral-500">（{o.note}）</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-neutral-400">根拠: {a.estimate.basis}</p>
            </section>
          </div>
        </>
      )}

      {/* クライアント対応 */}
      <section className="af-card p-5 space-y-3">
        <h2 className="text-sm font-bold">
          クライアント対応（先方メッセージを貼ると返信案を作ります・送信はあなた）
        </h2>
        {(job.thread ?? []).length > 0 && (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(job.thread ?? []).map((m, i) => (
              <div key={i} className={m.who === "client" ? "" : "pl-4"}>
                <p className="text-xs font-bold text-neutral-500">
                  {m.who === "client" ? "クライアント" : "返信案"}
                </p>
                <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm">
                  {m.text}
                </p>
                {m.who === "me_draft" && (
                  <div className="mt-1">
                    <Copyable label="この返信案をコピー" text={m.text} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            className="af-input min-h-12 flex-1 text-sm"
            placeholder="クライアントからのメッセージを貼り付け"
            value={clientMsg}
            onChange={(e) => setClientMsg(e.target.value)}
          />
          <button
            className="af-btn-primary shrink-0"
            disabled={busy || !clientMsg.trim()}
            onClick={async () => {
              setBusy(true);
              showNotice("返信案を生成中…");
              try {
                const res = await fetch(`/api/jobs/${id}/reply`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ clientMessage: clientMsg }),
                });
                const data = await safeJson(res);
                if (!res.ok) throw new Error(data.error ?? "生成に失敗しました");
                setClientMsg("");
                await load();
                showNotice("返信案を作成しました（コピーして送信してください）");
              } catch (e) {
                showNotice(`⚠ ${e instanceof Error ? e.message : "生成に失敗しました"}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            返信案を作る
          </button>
        </div>
      </section>

      {/* 作業契約（採用時） */}
      {job.workContract && (
        <section className="af-card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold">Work Contract（開発部へ渡す作業定義）</h2>
            <Copyable
              label="JSONをコピー"
              text={JSON.stringify(job.workContract, null, 2)}
            />
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl bg-neutral-900 p-4 text-xs text-neutral-100">
            {JSON.stringify(job.workContract, null, 2)}
          </pre>
        </section>
      )}

      {/* 応募記録 */}
      <section className="af-card p-5 space-y-3">
        <h2 className="text-sm font-bold">応募・結果の記録（結果学習の元データ）</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["APPLIED", "応募した"],
              ["REPLIED", "返信あり"],
              ["INTERVIEW", "面談"],
              ["WON", "採用"],
              ["LOST", "不採用"],
              ["ARCHIVED", "見送り"],
            ] as const
          ).map(([st, label]) => (
            <button
              key={st}
              className={job.status === st ? "af-btn-primary" : "af-btn-ghost"}
              disabled={busy}
              onClick={() =>
                patch(
                  {
                    status: st,
                    outcome:
                      st === "WON"
                        ? { result: "won" }
                        : st === "LOST"
                          ? { result: "lost" }
                          : st === "REPLIED"
                            ? { replied: true }
                            : st === "INTERVIEW"
                              ? { interviewed: true }
                              : {},
                  },
                  `「${label}」を記録しました`
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="af-label">提示価格</label>
            <input
              className="af-input"
              placeholder="例: 250,000円 / $1,800"
              value={outcomeBuf.priceOffered ?? job.outcome.priceOffered ?? ""}
              onChange={(e) =>
                setOutcomeBuf((b) => ({ ...b, priceOffered: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="af-label">契約金額（採用時）</label>
            <input
              className="af-input"
              value={outcomeBuf.contractAmount ?? job.outcome.contractAmount ?? ""}
              onChange={(e) =>
                setOutcomeBuf((b) => ({ ...b, contractAmount: e.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <label className="af-label">メモ（不採用理由・顧客の質問・気づき）</label>
          <textarea
            className="af-input min-h-16 text-sm"
            value={outcomeBuf.notes ?? job.outcome.notes ?? ""}
            onChange={(e) => setOutcomeBuf((b) => ({ ...b, notes: e.target.value }))}
          />
        </div>
        <button
          className="af-btn-ghost"
          disabled={busy}
          onClick={() =>
            patch(
              {
                outcome: {
                  priceOffered: outcomeBuf.priceOffered ?? job.outcome.priceOffered,
                  contractAmount: outcomeBuf.contractAmount ?? job.outcome.contractAmount,
                  notes: outcomeBuf.notes ?? job.outcome.notes,
                },
              },
              "記録を保存しました"
            )
          }
        >
          記録を保存
        </button>
      </section>

      {/* 原文 */}
      <section className="af-card p-5">
        <h2 className="mb-2 text-sm font-bold">案件原文</h2>
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-xs text-neutral-600">
          {job.rawText}
        </pre>
      </section>
    </main>
  );
}
