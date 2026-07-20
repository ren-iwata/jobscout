import Link from "next/link";
import DeleteJobButton from "@/components/DeleteJobButton";
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

      {screened.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-neutral-600">
            未精査（スコア順・タップでフル分析）
          </h2>
          <ul className="space-y-2">
            {screened.map((j) => (
              <li key={j.id} className="af-card flex items-center gap-2 p-3 hover:border-blue-300">
                <Link
                  href={`/jobs/${j.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="af-chip bg-neutral-800 text-white">
                    {j.quickScore ?? "—"}/10
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{j.rawText.slice(0, 40)}</p>
                    <p className="truncate text-xs text-neutral-400">
                      {j.screenReason}
                    </p>
                  </div>
                </Link>
                <DeleteJobButton id={j.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">全案件</h1>
        <Link href="/new" className="af-btn-primary">
          ＋ 案件を取り込む
        </Link>
      </div>

      {jobs.length === 0 ? (
        <p className="af-card p-8 text-center text-sm text-neutral-400">
          まだ案件がありません。「案件を分析する」から案件文を貼り付けてください。
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li key={j.id} className="af-card flex items-center gap-2 p-4 hover:border-blue-300">
              <Link
                href={`/jobs/${j.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {j.analysis?.title ?? j.rawText.slice(0, 30)}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {PLATFORM_LABELS[j.platform]} ・ {j.id} ・{" "}
                    {new Date(j.createdAt).toLocaleString("ja-JP")}
                  </p>
                </div>
                {j.analysis?.riskOverall && j.analysis.riskOverall !== "ok" && (
                  <span className="af-chip bg-red-50 text-red-700">
                    {RISK_LABELS[j.analysis.riskOverall]}
                  </span>
                )}
                {j.analysis?.verdict && (
                  <span
                    className={`af-chip ${VERDICT_COLORS[j.analysis.verdict] ?? "bg-neutral-100"}`}
                  >
                    {VERDICT_LABELS[j.analysis.verdict]}
                  </span>
                )}
                <span className="af-chip bg-neutral-100 text-neutral-600">
                  {STATUS_LABELS[j.status]}
                </span>
              </Link>
              <DeleteJobButton id={j.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
