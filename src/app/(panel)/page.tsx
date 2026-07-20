import Link from "next/link";
import JobBoard, { type JobRow } from "@/components/JobBoard";
import QueriesCard from "@/components/QueriesCard";
import { listJobs } from "@/lib/store";
import {
  PLATFORM_LABELS,
  RISK_LABELS,
  STATUS_LABELS,
  VERDICT_LABELS,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const VERDICT_COLORS: Record<string, string> = {
  APPLY_NOW: "bg-green-100 text-green-700",
  APPLY_AFTER_CLARIFICATION: "bg-blue-50 text-blue-700",
  APPLY_AS_DISCOVERY: "bg-purple-50 text-purple-700",
  WATCH: "bg-amber-50 text-amber-700",
  SKIP: "bg-neutral-100 text-neutral-500",
  REJECT_RISK: "bg-red-100 text-red-700",
};

const VERDICT_RANK: Record<string, number> = {
  APPLY_NOW: 0,
  APPLY_AFTER_CLARIFICATION: 1,
  APPLY_AS_DISCOVERY: 2,
};

export default async function Dashboard() {
  // アーカイブ済み（ノイズ・見送り）は表示しない
  const jobs = (await listJobs()).filter((j) => j.status !== "ARCHIVED");
  const applied = jobs.filter((j) => j.outcome.appliedAt).length;
  const replied = jobs.filter((j) => j.outcome.replied).length;
  const won = jobs.filter((j) => j.outcome.result === "won").length;

  // 「今取るべき案件」= 応募推奨判定が出ていてまだ応募していないもの（判定順→スコア順）
  const actionable = jobs
    .filter(
      (j) =>
        j.status === "ANALYZED" &&
        j.analysis &&
        j.analysis.verdict in VERDICT_RANK
    )
    .sort(
      (a, b) =>
        VERDICT_RANK[a.analysis!.verdict] - VERDICT_RANK[b.analysis!.verdict] ||
        (b.quickScore ?? 0) - (a.quickScore ?? 0)
    );
  const screened = jobs
    .filter((j) => j.status === "SCREENED")
    .sort((a, b) => (b.quickScore ?? 0) - (a.quickScore ?? 0));

  // クライアント側（選択削除UI）へ渡す軽量表示データ
  const screenedRows: JobRow[] = screened.map((j) => ({
    id: j.id,
    main: j.rawText.slice(0, 40),
    sub: j.screenReason ?? "",
    score: j.quickScore ?? null,
  }));
  const allRows: JobRow[] = jobs.map((j) => ({
    id: j.id,
    main: j.analysis?.title ?? j.rawText.slice(0, 30),
    sub: `${PLATFORM_LABELS[j.platform]} ・ ${j.id} ・ ${new Date(j.createdAt).toLocaleString("ja-JP")}`,
    riskLabel:
      j.analysis?.riskOverall && j.analysis.riskOverall !== "ok"
        ? RISK_LABELS[j.analysis.riskOverall]
        : null,
    verdictKey: j.analysis?.verdict ?? null,
    verdictLabel: j.analysis?.verdict ? VERDICT_LABELS[j.analysis.verdict] : null,
    statusLabel: STATUS_LABELS[j.status],
  }));

  return (
    <main>
      <section className="mb-6 grid grid-cols-4 gap-2">
        {(
          [
            ["分析", jobs.length],
            ["応募", applied],
            ["返信", replied],
            ["採用", won],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="af-card p-3 text-center">
            <p className="text-xl font-bold">{n}</p>
            <p className="text-xs text-neutral-500">{label}</p>
          </div>
        ))}
      </section>

      <QueriesCard />

      {actionable.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-green-800">
            ▶ 今取るべき案件（{actionable.length}件）
          </h2>
          <ul className="space-y-2">
            {actionable.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="af-card flex items-center gap-3 border-green-200 p-4 hover:border-green-400"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {j.analysis?.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {j.analysis?.verdictReasoning}
                    </p>
                  </div>
                  <span
                    className={`af-chip ${VERDICT_COLORS[j.analysis!.verdict]}`}
                  >
                    {VERDICT_LABELS[j.analysis!.verdict]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JobBoard screened={screenedRows} all={allRows} />
    </main>
  );
}
