// DATABASE_URL の解決（ワーカー用）: env優先→Vercelプロジェクト環境変数から復号取得
const VC = "https://api.vercel.com";

export async function resolveDbUrl() {
  if (process.env.DATABASE_URL?.trim().startsWith("postgres")) {
    return process.env.DATABASE_URL.trim();
  }
  const token = (process.env.VERCEL_TOKEN ?? "").trim();
  if (!token) throw new Error("DATABASE_URL も VERCEL_TOKEN も無い");
  const vc = async (p) => {
    const r = await fetch(VC + p, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const teams = await vc("/v2/teams");
  const team = teams.body?.teams?.[0] ?? null;
  const teamAnd = team ? `?teamId=${team.id}&` : "?";
  for (const proj of ["jobscout", "agentfront-claude"]) {
    const res = await vc(`/v9/projects/${proj}/env${teamAnd}decrypt=true`);
    const hit = (res.body?.envs ?? []).find((e) => e.key === "DATABASE_URL");
    if (!hit) continue;
    let v = typeof hit.value === "string" ? hit.value : null;
    if (!v || !v.startsWith("postgres")) {
      const one = await vc(`/v9/projects/${proj}/env/${hit.id}${teamAnd}decrypt=true`);
      if (typeof one.body?.value === "string") v = one.body.value;
    }
    if (v && v.startsWith("postgres")) return v.trim();
  }
  throw new Error("DATABASE_URLをVercelから取得できなかった");
}
