// ワーカー本体（GitHub Actions上で実行）
// 1. .worker/kick に直接指示があれば実行（pushトリガー用）
// 2. js_tasks キューの queued タスクを処理（UIからのenqueue用）
// --dry: DBを使わずローカル検証（MOCK_MODE=1と併用）
import { readFileSync, writeFileSync, existsSync } from "fs";
import { runCapabilityScan } from "./capability_scan.mjs";
import { runMailIngest } from "./mail_ingest.mjs";
import { resolveDbUrl } from "../lib/dburl.mjs";

const DRY = process.argv.includes("--dry");

function makeKv(sql) {
  if (DRY) {
    const mem = existsSync("./kv.local.json") ? JSON.parse(readFileSync("./kv.local.json", "utf8")) : {};
    return {
      async get(k) { return mem[k] ?? null; },
      async set(k, v) { mem[k] = v; writeFileSync("./kv.local.json", JSON.stringify(mem, null, 2)); },
    };
  }
  return {
    async get(k) {
      const rows = await sql`select value from js_kv where key = ${k}`;
      return rows.length ? rows[0].value : null;
    },
    async set(k, v) {
      await sql`insert into js_kv (key, value, updated_at) values (${k}, ${sql.json(v)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
    },
  };
}

async function execTask(kind, payload, kv) {
  if (kind === "capability_scan") return runCapabilityScan(payload ?? {}, kv);
  if (kind === "mail_ingest") return runMailIngest(payload ?? {});
  throw new Error(`unknown task kind: ${kind}`);
}

// 定期実行時はメール取り込みを常時試行（未設定ならスキップ扱い）
const ALWAYS_TASKS = [{ kind: "mail_ingest", payload: {} }];

async function main() {
  let sql = null;
  if (!DRY) {
    const { default: postgres } = await import("postgres");
    sql = postgres(await resolveDbUrl(), { prepare: false, max: 1, connect_timeout: 15 });
    await sql`create table if not exists js_tasks (
      id bigserial primary key, kind text not null, payload jsonb,
      status text not null default 'queued', result jsonb,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now())`;
  }
  const kv = makeKv(sql);
  const summary = [];

  // kick 指示
  if (existsSync(".worker/kick")) {
    try {
      const kick = JSON.parse(readFileSync(".worker/kick", "utf8"));
      if (kick?.kind) {
        console.log(`kick: ${kick.kind}`);
        const result = await execTask(kick.kind, kick.payload, kv);
        summary.push({ source: "kick", kind: kick.kind, ok: true, result });
      }
    } catch (e) {
      console.error("kick failed:", e);
      summary.push({ source: "kick", ok: false, error: String(e).slice(0, 300) });
    }
  }

  // 定期タスク（常時試行）
  for (const t of ALWAYS_TASKS) {
    try {
      const result = await execTask(t.kind, t.payload, kv);
      summary.push({ source: "always", kind: t.kind, ok: true, result });
    } catch (e) {
      summary.push({ source: "always", kind: t.kind, ok: false, error: String(e).slice(0, 200) });
    }
  }

  // キュー処理
  if (sql) {
    const tasks = await sql`select id, kind, payload from js_tasks where status = 'queued' order by id limit 5`;
    for (const t of tasks) {
      await sql`update js_tasks set status = 'running', updated_at = now() where id = ${t.id}`;
      try {
        const result = await execTask(t.kind, t.payload, kv);
        await sql`update js_tasks set status = 'done', result = ${sql.json(result)}, updated_at = now() where id = ${t.id}`;
        summary.push({ source: "queue", id: Number(t.id), kind: t.kind, ok: true });
        console.log(`task ${t.id} (${t.kind}): done`);
      } catch (e) {
        await sql`update js_tasks set status = 'error', result = ${sql.json({ error: String(e).slice(0, 500) })}, updated_at = now() where id = ${t.id}`;
        summary.push({ source: "queue", id: Number(t.id), kind: t.kind, ok: false, error: String(e).slice(0, 200) });
        console.error(`task ${t.id} (${t.kind}): error`, e);
      }
    }
    await sql.end({ timeout: 5 });
  }

  writeFileSync("worker_summary.json", JSON.stringify({ at: new Date().toISOString(), summary }, null, 2));
  console.log("worker done:", JSON.stringify(summary));
  if (summary.some((s) => s.ok === false)) process.exit(1);
}

main().catch((e) => {
  console.error("worker crashed:", e);
  writeFileSync("worker_summary.json", JSON.stringify({ at: new Date().toISOString(), crashed: String(e).slice(0, 500) }));
  process.exit(1);
});
