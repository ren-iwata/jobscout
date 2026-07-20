// ノイズ掃除: 選別止まり（SCREENED）でスコア2以下の案件をアーカイブする
// 対象は「運営メール・広告等が誤って案件登録されたもの」。削除ではなくARCHIVED（復元可能）。
// is_job_posting導入（選別時に破棄）以前に入ったノイズの後始末に使う。

export async function runNoiseSweep(payload, sql) {
  if (!sql) return { skipped: true, note: "DB無し（--dry）のためスキップ" };
  const maxScore = Number.isFinite(payload?.maxScore) ? payload.maxScore : 2;

  const rows = await sql`
    select id, data->>'quickScore' as score, left(data->>'rawText', 40) as head
    from js_jobs
    where data->>'status' = 'SCREENED'
      and (data->>'quickScore') is not null
      and (data->>'quickScore')::numeric <= ${maxScore}`;

  const archived = [];
  for (const r of rows) {
    await sql`
      update js_jobs
      set data = jsonb_set(jsonb_set(data, '{status}', '"ARCHIVED"'), '{updatedAt}', to_jsonb(now()::text))
      where id = ${r.id}`;
    await sql`
      insert into js_events (job_id, type, actor, data)
      values (${r.id}, 'status_change', 'system', ${sql.json({ from: "SCREENED", to: "ARCHIVED", by: "noise_sweep" })})`;
    archived.push({ id: r.id, score: r.score, head: r.head });
  }
  return { archived: archived.length, items: archived };
}
