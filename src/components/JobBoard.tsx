"use client";

// 未精査・全案件の一覧（選択モードで複数一括削除に対応）
// 同じ案件レコードを見ているため、未精査で削除すれば全案件からも消える（逆も同じ）
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DeleteJobButton from "@/components/DeleteJobButton";

const VERDICT_COLORS: Record<string, string> = {
  APPLY_NOW: "bg-green-100 text-green-700",
  APPLY_AFTER_CLARIFICATION: "bg-blue-50 text-blue-700",
  APPLY_AS_DISCOVERY: "bg-purple-50 text-purple-700",
  WATCH: "bg-amber-50 text-amber-700",
  SKIP: "bg-neutral-100 text-neutral-500",
  REJECT_RISK: "bg-red-100 text-red-700",
};

export interface JobRow {
  id: string;
  main: string;
  sub: string;
  score?: number | null;
  riskLabel?: string | null;
  verdictKey?: string | null;
  verdictLabel?: string | null;
  statusLabel?: string | null;
}

function RowChips({ r }: { r: JobRow }) {
  return (
    <>
      {r.riskLabel && (
        <span className="af-chip bg-red-50 text-red-700">{r.riskLabel}</span>
      )}
      {r.verdictKey && r.verdictLabel && (
        <span
          className={`af-chip ${VERDICT_COLORS[r.verdictKey] ?? "bg-neutral-100"}`}
        >
          {r.verdictLabel}
        </span>
      )}
      {r.statusLabel && (
        <span className="af-chip bg-neutral-100 text-neutral-600">
          {r.statusLabel}
        </span>
      )}
    </>
  );
}

export default function JobBoard({
  screened,
  all,
}: {
  screened: JobRow[];
  all: JobRow[];
}) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setArming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setArming(false);
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!arming) {
      setArming(true);
      setTimeout(() => setArming(false), 4000);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/jobs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (res.ok) {
        exitSelect();
        router.refresh();
      } else {
        setArming(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function renderRow(r: JobRow, kind: "screened" | "all") {
    const body = (
      <>
        {kind === "screened" && (
          <span className="af-chip bg-neutral-800 text-white">
            {r.score ?? "—"}/10
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm ${kind === "all" ? "font-semibold" : ""}`}
          >
            {r.main}
          </p>
          <p className="mt-0.5 truncate text-xs text-neutral-400">{r.sub}</p>
        </div>
        {kind === "all" && <RowChips r={r} />}
      </>
    );
    if (selectMode) {
      const on = selected.has(r.id);
      return (
        <li key={r.id}>
          <button
            onClick={() => toggle(r.id)}
            className={`af-card flex w-full items-center gap-3 p-3 text-left ${
              on ? "border-red-400 bg-red-50" : ""
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                on
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-neutral-300 bg-white"
              }`}
            >
              {on ? "✓" : ""}
            </span>
            {body}
          </button>
        </li>
      );
    }
    return (
      <li
        key={r.id}
        className="af-card flex items-center gap-2 p-3 hover:border-blue-300"
      >
        <Link
          href={`/jobs/${r.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {body}
        </Link>
        <DeleteJobButton id={r.id} />
      </li>
    );
  }

  const selectToggle = (
    <button
      className="af-btn-ghost text-xs"
      onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
    >
      {selectMode ? "選択をやめる" : "選択して削除"}
    </button>
  );

  return (
    <>
      {screened.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-600">
              未精査（スコア順・タップでフル分析）
            </h2>
            {selectToggle}
          </div>
          <ul className="space-y-2">
            {screened.map((r) => renderRow(r, "screened"))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">全案件</h1>
        <div className="flex items-center gap-2">
          {screened.length === 0 && selectToggle}
          <Link href="/new" className="af-btn-primary">
            ＋ 案件を取り込む
          </Link>
        </div>
      </div>

      {all.length === 0 ? (
        <p className="af-card p-8 text-center text-sm text-neutral-400">
          まだ案件がありません。「案件を取り込む」から案件文を貼り付けてください。
        </p>
      ) : (
        <ul className="space-y-2">{all.map((r) => renderRow(r, "all"))}</ul>
      )}

      {selectMode && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[94%] max-w-lg -translate-x-1/2 items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-xl">
          <span className="text-sm font-bold">{selected.size}件選択中</span>
          {screened.length > 0 && (
            <button
              className="text-xs text-blue-700 underline"
              onClick={() => {
                setArming(false);
                setSelected(new Set(screened.map((r) => r.id)));
              }}
            >
              未精査を全選択
            </button>
          )}
          <button
            className="text-xs text-neutral-500 underline"
            onClick={() => {
              setArming(false);
              setSelected(new Set());
            }}
          >
            解除
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button className="af-btn-ghost text-xs" onClick={exitSelect}>
              キャンセル
            </button>
            <button
              className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${
                arming ? "bg-red-600" : "bg-neutral-900"
              } disabled:opacity-40`}
              disabled={busy || selected.size === 0}
              onClick={deleteSelected}
            >
              {busy
                ? "削除中…"
                : arming
                  ? "本当に削除する（戻せません）"
                  : `${selected.size}件を削除`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
