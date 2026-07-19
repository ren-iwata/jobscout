// 能力分析エンジン v1（ワーカー実行・ネットワーク自由な環境で動かす）
// 入力（payload）: { githubUsers?: string[], repos?: ["owner/name"], urls?: string[] }
// 処理: 事実収集（リポジトリメタ・言語・README・稼働URL検証）→ LLMで「検証済み能力」へ翻訳
// 出力: capability_registry（js_kv）＋ profile.evidence への同期（自動生成分は source:"auto"）
import Anthropic from "@anthropic-ai/sdk";

const GH = "https://api.github.com";
const MODEL = process.env.AF_MODEL_CONVERSATION || "claude-sonnet-5";
const MOCK = process.env.MOCK_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

async function gh(path) {
  const headers = { "User-Agent": "jobscout-capability-scan", Accept: "application/vnd.github+json" };
  const tok = (process.env.GITHUB_TOKEN ?? "").trim();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const r = await fetch(GH + path, { headers });
  if (!r.ok) return null;
  return r.json();
}

async function collectRepoFacts(fullName) {
  const meta = await gh(`/repos/${fullName}`);
  if (!meta) return { fullName, error: "unreachable(権限外か非公開)" };
  const langs = (await gh(`/repos/${fullName}/languages`)) ?? {};
  let readme = "";
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${fullName}/${meta.default_branch}/README.md`, {
      headers: { "User-Agent": "jobscout" },
    });
    if (r.ok) readme = (await r.text()).slice(0, 4000);
  } catch { /* noop */ }
  const tree = (await gh(`/repos/${fullName}/contents/`)) ?? [];
  return {
    fullName,
    description: meta.description,
    private: meta.private,
    pushedAt: meta.pushed_at,
    createdAt: meta.created_at,
    sizeKb: meta.size,
    languages: langs,
    topLevel: Array.isArray(tree) ? tree.map((t) => t.name).slice(0, 40) : [],
    readmeExcerpt: readme,
  };
}

async function probeUrl(url) {
  const out = { url, checkedAt: new Date().toISOString() };
  try {
    const t0 = Date.now();
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    out.status = r.status;
    out.ms = Date.now() - t0;
    const text = (await r.text()).slice(0, 3000);
    out.titleHint = /<title>([^<]{0,120})/.exec(text)?.[1] ?? "";
    out.bodyHint = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500);
    try {
      const h = await fetch(new URL("/api/health", url), { signal: AbortSignal.timeout(8000) });
      if (h.ok) out.health = await h.json();
    } catch { /* noop */ }
  } catch (e) {
    out.error = String(e).slice(0, 120);
  }
  return out;
}

const SYNTH_TOOL = {
  name: "capability_registry",
  description: "収集された事実から検証済み能力レジストリを構築する。必ずこのツールを使う。",
  input_schema: {
    type: "object",
    properties: {
      evidence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string" },
            url: { type: "string" },
            summary: { type: "string", description: "受注文脈で効く形の要約（日本語）" },
            capabilities: { type: "array", items: { type: "string" } },
            verification: { type: "string", description: "何が事実として確認できたか（稼働応答・リポ実体等）" },
          },
          required: ["id", "name", "type", "summary", "capabilities", "verification"],
        },
      },
      skills: {
        type: "object",
        additionalProperties: { type: "array", items: { type: "string" } },
        description: "カテゴリ→技術の能力マップ（事実に基づくもののみ）",
      },
      fitJobTypes: { type: "array", items: { type: "string" }, description: "適合する案件タイプ" },
      searchQueries: {
        type: "object",
        properties: {
          crowdworks: { type: "array", items: { type: "string" } },
          upwork: { type: "array", items: { type: "string" } },
        },
        required: ["crowdworks", "upwork"],
      },
      notes: { type: "string", description: "能力の穴・伸ばすべき方向の所見" },
    },
    required: ["evidence", "skills", "fitJobTypes", "searchQueries", "notes"],
  },
};

async function synthesize(facts) {
  if (MOCK) {
    return {
      evidence: facts.urls
        .filter((u) => u.status === 200)
        .map((u, i) => ({
          id: `auto-${i}`,
          name: u.titleHint || u.url,
          type: "公開Webサービス（稼働確認済み）",
          url: u.url,
          summary: "モック要約",
          capabilities: ["Web公開"],
          verification: `HTTP 200 (${u.ms}ms)`,
        })),
      skills: { Web: ["Next.js"] },
      fitJobTypes: ["Web開発"],
      searchQueries: { crowdworks: ["AI 開発"], upwork: ["AI development"] },
      notes: "モック",
    };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `あなたは能力分析エンジンである。フリーランサーの成果物について収集された「事実」（リポジトリ実体・稼働URLの応答）だけを根拠に、受注活動で使える検証済み能力レジストリを構築する。
原則: 事実にないことを盛らない。稼働確認できたものは「稼働確認済み」と明記する。エラーだったURLは含めない。summaryは発注者に価値が伝わる日本語で書く。idは安定したslugにする。`,
    messages: [
      {
        role: "user",
        content: `収集された事実:\n${JSON.stringify(facts, null, 1).slice(0, 40000)}\n\nレジストリを構築せよ。`,
      },
    ],
    tools: [SYNTH_TOOL],
    tool_choice: { type: "tool", name: "capability_registry" },
  });
  const tu = res.content.find((b) => b.type === "tool_use");
  if (!tu) throw new Error("capability_registry tool not called");
  return tu.input;
}

export async function runCapabilityScan(payload, kv) {
  const users = payload.githubUsers ?? [];
  const repoNames = new Set(payload.repos ?? []);
  for (const u of users) {
    const list = (await gh(`/users/${u}/repos?sort=pushed&per_page=15`)) ?? [];
    for (const r of list) if (!r.fork) repoNames.add(r.full_name);
  }
  const repos = [];
  for (const name of [...repoNames].slice(0, 12)) {
    repos.push(await collectRepoFacts(name));
  }
  const urls = [];
  for (const u of payload.urls ?? []) urls.push(await probeUrl(u));

  const facts = { collectedAt: new Date().toISOString(), repos, urls };
  const registry = { ...(await synthesize(facts)), facts, updatedAt: new Date().toISOString() };
  await kv.set("capability_registry", registry);

  // profile.evidence へ同期: 手動項目は保持し、auto項目を差し替え
  const profile = (await kv.get("profile")) ?? null;
  if (profile) {
    const manual = (profile.evidence ?? []).filter((e) => !String(e.id).startsWith("auto-"));
    const auto = registry.evidence.map((e) => ({ ...e, id: `auto-${e.id.replace(/^auto-/, "")}` }));
    // 同名の手動項目がある場合は手動を優先（URLで照合）
    const manualUrls = new Set(manual.map((m) => m.url).filter(Boolean));
    profile.evidence = [...manual, ...auto.filter((a) => !a.url || !manualUrls.has(a.url))];
    await kv.set("profile", profile);
  }
  return {
    repos: repos.length,
    urls: urls.length,
    evidence: registry.evidence.length,
    queries: registry.searchQueries,
  };
}
