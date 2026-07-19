// インフラ整備（GitHub Actions上で実行・冪等）— jobscout版
// - Vercel: プロジェクト jobscout を find-or-create（Git連携試行・git自動ビルドは無効化）
// - DATABASE_URL: agentfront-claude プロジェクトの環境変数から再利用（同一Supabaseに js_ テーブルで相乗り）
// 必要環境変数: VERCEL_TOKEN, ANTHROPIC_API_KEY, ADMIN_PASSWORD（SUPABASE_TOKENは新規作成時のみ使用）
import { writeFileSync, mkdirSync } from "fs";

const VC = "https://api.vercel.com";
const PROJECT = "jobscout";
const DB_SOURCE_PROJECT = "agentfront-claude";
const REPO = "ren-iwata/jobscout";

const need = (k) => {
  const v = (process.env[k] ?? "").trim();
  if (!v) throw new Error(`missing env: ${k}`);
  return v;
};
const VERCEL_TOKEN = need("VERCEL_TOKEN");
const ANTHROPIC_API_KEY = need("ANTHROPIC_API_KEY");
const ADMIN_PASSWORD = need("ADMIN_PASSWORD");

async function vc(path, opts = {}) {
  const res = await fetch(VC + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}
const mask = (v) => console.log(`::add-mask::${v}`);

async function readDbUrlFrom(projectIdOrName, teamAnd) {
  const res = await vc(`/v9/projects/${projectIdOrName}/env${teamAnd}decrypt=true`);
  const envs = res.body?.envs ?? [];
  const hit = envs.find((e) => e.key === "DATABASE_URL");
  if (!hit) return null;
  let value = typeof hit.value === "string" ? hit.value : null;
  if (!value || !value.startsWith("postgres")) {
    const one = await vc(`/v9/projects/${projectIdOrName}/env/${hit.id}${teamAnd}decrypt=true`);
    if (typeof one.body?.value === "string") value = one.body.value;
  }
  return value && value.startsWith("postgres") ? value.trim() : null;
}

async function testDbUrl(url) {
  try {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10 });
    await sql`select 1`;
    await sql.end({ timeout: 5 });
    return true;
  } catch (e) {
    console.log(`db: 疎通確認に失敗（${String(e).slice(0, 120)}）`);
    return false;
  }
}

// チーム特定
const teams = await vc("/v2/teams");
const team = teams.body?.teams?.[0] ?? null;
const teamQ = team ? `?teamId=${team.id}` : "";
const teamAnd = team ? `?teamId=${team.id}&` : "?";
console.log(`vercel: team=${team?.slug ?? "(personal)"}`);

// プロジェクト ensure
let proj = await vc(`/v9/projects/${PROJECT}${teamQ}`);
if (proj.status === 404) {
  proj = await vc(`/v11/projects${teamQ}`, {
    method: "POST",
    body: JSON.stringify({
      name: PROJECT,
      framework: "nextjs",
      gitRepository: { type: "github", repo: REPO },
    }),
  });
  if (proj.status >= 300) {
    console.log(`vercel: git連携付き作成は不可（${proj.status}）→連携なしで作成`);
    proj = await vc(`/v11/projects${teamQ}`, {
      method: "POST",
      body: JSON.stringify({ name: PROJECT, framework: "nextjs" }),
    });
  } else {
    console.log("vercel: project created WITH git link");
  }
  if (proj.status >= 300) throw new Error(`vercel create failed: ${proj.status} ${JSON.stringify(proj.body)}`);
} else if (proj.status >= 300) {
  throw new Error(`vercel get project failed: ${proj.status}`);
} else {
  console.log("vercel: project found");
}
const projectId = proj.body.id;

// git自動ビルド無効化（デプロイはCI一本化・agentfront run11事故の恒久対処と同方針）
const patch = await vc(`/v9/projects/${projectId}${teamQ}`, {
  method: "PATCH",
  body: JSON.stringify({ commandForIgnoringBuildStep: "exit 0" }),
});
console.log(patch.status < 300 ? "vercel: git自動ビルド無効化" : `vercel: ignoreCommand設定失敗（${patch.status}）続行`);

// 本番ドメイン
let domain = `${PROJECT}.vercel.app`;
const domains = await vc(`/v9/projects/${projectId}/domains${teamQ}`);
const vercelApp = (domains.body?.domains ?? []).find((d) => d.name.endsWith(".vercel.app"));
if (vercelApp) domain = vercelApp.name;
console.log(`vercel: production domain=${domain}`);

mkdirSync(".vercel", { recursive: true });
writeFileSync(".vercel/project.json", JSON.stringify({ projectId, orgId: team ? team.id : proj.body.accountId }));
writeFileSync(".vercel/prod_domain.txt", domain);

// DATABASE_URL: 自プロジェクト→agentfront-claude の順で再利用
let dbUrl = await readDbUrlFrom(projectId, teamAnd);
if (dbUrl && (await testDbUrl(dbUrl))) {
  console.log("db: 自プロジェクトの既存DATABASE_URLを再利用");
} else {
  dbUrl = await readDbUrlFrom(DB_SOURCE_PROJECT, teamAnd);
  if (dbUrl && (await testDbUrl(dbUrl))) {
    console.log(`db: ${DB_SOURCE_PROJECT} のDATABASE_URLを共用（js_テーブルで分離）`);
  } else {
    throw new Error(
      `DATABASE_URLを取得できません。${DB_SOURCE_PROJECT} のVercel環境変数を確認してください`
    );
  }
}
mask(dbUrl);

// env upsert
const envs = [
  { key: "ANTHROPIC_API_KEY", value: ANTHROPIC_API_KEY },
  { key: "ADMIN_PASSWORD", value: ADMIN_PASSWORD },
  { key: "DATABASE_URL", value: dbUrl },
].map((e) => ({ ...e, type: "encrypted", target: ["production", "preview"] }));
const up = await vc(`/v10/projects/${projectId}/env${teamAnd}upsert=true`, {
  method: "POST",
  body: JSON.stringify(envs),
});
if (up.status >= 300) throw new Error(`vercel env upsert failed: ${up.status} ${JSON.stringify(up.body)}`);
console.log("vercel: env vars upserted");
console.log("provision: done");
