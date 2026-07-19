// 本番煙テスト（LLMを呼ばない・費用ゼロ）
const url = process.argv[2]?.replace(/\/$/, "");
if (!url) {
  console.error("usage: node scripts/smoke_prod.mjs <base-url>");
  process.exit(1);
}

let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok: ${name}`);
  else {
    failed++;
    console.error(`  NG: ${name} ${extra}`);
  }
};

const health = await fetch(`${url}/api/health`).then(async (r) => ({
  status: r.status,
  body: await r.json().catch(() => null),
}));
check("health 200", health.status === 200, JSON.stringify(health.body));
check("health ok", health.body?.ok === true);
check("storage is pg", health.body?.storage === "pg", `got: ${health.body?.storage}`);
check("db roundtrip ok", health.body?.db === "ok", `got: ${health.body?.db}`);
check("not mock mode", health.body?.mock === false);

// 未ログインでトップ→ログインへリダイレクトされて200で描画される
const root = await fetch(url, { redirect: "follow" }).then(async (r) => ({
  status: r.status,
  text: await r.text(),
}));
check("root 200", root.status === 200);
check("login gate renders", root.text.includes("JOBSCOUT") || root.text.includes("ログイン"));

const badLogin = await fetch(`${url}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "wrong-password" }),
});
check("auth enforced", badLogin.status === 401);
check("jobs api protected", (await fetch(`${url}/api/jobs`)).status === 401);

console.log(failed === 0 ? "\nSMOKE: ALL PASS" : `\nSMOKE: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
