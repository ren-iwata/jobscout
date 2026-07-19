// 保存層（二層ドライバ・agentfrontと同型）
// - ローカル: data/jobs/<id>/job.json + events.jsonl
// - 本番: DATABASE_URL 設定時は Postgres（js_jobs / js_events / js_kv）
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { AuditEvent, EventType, JobCase } from "./types";
import { ensureSchema, getSql, pgEnabled } from "./db";

const DATA_DIR = process.env.JS_DATA_DIR || path.join(process.cwd(), "data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function jobDir(id: string) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error("invalid job id");
  return path.join(JOBS_DIR, id);
}

export function newJobId(): string {
  const d = new Date();
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `JS-${ymd}-${rand}`;
}

export async function saveJob(j: JobCase): Promise<void> {
  j.updatedAt = new Date().toISOString();
  if (pgEnabled()) {
    await ensureSchema();
    const sql = getSql();
    await sql`insert into js_jobs (id, data, updated_at)
      values (${j.id}, ${sql.json(j as JsonValue)}, now())
      on conflict (id) do update set data = excluded.data, updated_at = now()`;
    return;
  }
  const dir = jobDir(j.id);
  await ensureDir(dir);
  const tmp = path.join(dir, ".job.json.tmp");
  await fs.writeFile(tmp, JSON.stringify(j, null, 2), "utf8");
  await fs.rename(tmp, path.join(dir, "job.json"));
}

export async function getJob(id: string): Promise<JobCase | null> {
  if (pgEnabled()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`select data from js_jobs where id = ${id}`;
    return rows.length ? (rows[0].data as JobCase) : null;
  }
  try {
    const raw = await fs.readFile(path.join(jobDir(id), "job.json"), "utf8");
    return JSON.parse(raw) as JobCase;
  } catch {
    return null;
  }
}

export async function listJobs(): Promise<JobCase[]> {
  if (pgEnabled()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`select data from js_jobs order by updated_at desc`;
    return rows.map((r) => r.data as JobCase);
  }
  try {
    await ensureDir(JOBS_DIR);
    const entries = await fs.readdir(JOBS_DIR, { withFileTypes: true });
    const jobs: JobCase[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const j = await getJob(e.name);
      if (j) jobs.push(j);
    }
    jobs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return jobs;
  } catch {
    return [];
  }
}

export async function appendEvent(
  jobId: string,
  type: EventType,
  actor: AuditEvent["actor"],
  data?: unknown
): Promise<void> {
  if (pgEnabled()) {
    await ensureSchema();
    const sql = getSql();
    await sql`insert into js_events (job_id, type, actor, data)
      values (${jobId}, ${type}, ${actor}, ${
        data === undefined ? null : sql.json(data as JsonValue)
      })`;
    return;
  }
  const dir = jobDir(jobId);
  await ensureDir(dir);
  const ev: AuditEvent = { at: new Date().toISOString(), type, actor, data };
  await fs.appendFile(path.join(dir, "events.jsonl"), JSON.stringify(ev) + "\n", "utf8");
}

export async function readEvents(jobId: string): Promise<AuditEvent[]> {
  if (pgEnabled()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`select at, type, actor, data from js_events
      where job_id = ${jobId} order by id asc`;
    return rows.map((r) => ({
      at: new Date(r.at as unknown as string).toISOString(),
      type: r.type as EventType,
      actor: r.actor as AuditEvent["actor"],
      data: r.data ?? undefined,
    }));
  }
  try {
    const raw = await fs.readFile(path.join(jobDir(jobId), "events.jsonl"), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as AuditEvent);
  } catch {
    return [];
  }
}

// ---- 汎用KV（プロフィール等） ----

export async function kvGet<T>(key: string): Promise<T | null> {
  if (pgEnabled()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`select value from js_kv where key = ${key}`;
    return rows.length ? (rows[0].value as T) : null;
  }
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${key}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (pgEnabled()) {
    await ensureSchema();
    const sql = getSql();
    await sql`insert into js_kv (key, value, updated_at)
      values (${key}, ${getSql().json(value as JsonValue)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
    return;
  }
  await ensureDir(DATA_DIR);
  await fs.writeFile(
    path.join(DATA_DIR, `${key}.json`),
    JSON.stringify(value, null, 2),
    "utf8"
  );
}
