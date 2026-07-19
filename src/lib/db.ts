// Postgres接続（本番用）。DATABASE_URL 未設定時はファイル保存（store.ts参照）。
// 注: DBはagentfront-claudeと同一のSupabaseプロジェクトに相乗り（無料枠節約）。
//     テーブルは js_ プレフィックスで分離する。
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __js_sql?: Sql };

export function pgEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getSql(): Sql {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!g.__js_sql) {
    g.__js_sql = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return g.__js_sql;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`create table if not exists js_jobs (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )`;
      await sql`create table if not exists js_events (
        id bigserial primary key,
        job_id text not null,
        at timestamptz not null default now(),
        type text not null,
        actor text not null,
        data jsonb
      )`;
      await sql`create index if not exists js_events_job on js_events (job_id, id)`;
      await sql`create table if not exists js_tasks (
        id bigserial primary key,
        kind text not null,
        payload jsonb,
        status text not null default 'queued',
        result jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`;
      await sql`create table if not exists js_kv (
        key text primary key,
        value jsonb not null,
        updated_at timestamptz not null default now()
      )`;
    })();
  }
  return schemaReady;
}
