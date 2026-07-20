// JobScout v0.1 自己テスト（モックモード・LLM不要）
// 前提: MOCK_MODE=1 ADMIN_PASSWORD=test-pass で起動済み
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PW = process.env.ADMIN_PASSWORD || "test-pass";

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ok: ${name}`);
  } else {
    failed++;
    console.error(`  NG: ${name} ${extra}`);
  }
}

async function jfetch(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* noop */
  }
  return { res, body };
}

async function main() {
  console.log(`E2E (mock) against ${BASE}`);

  // 1. 認証
  console.log("[1] 認証");
  check("unauthorized list rejected", (await jfetch("/api/jobs")).res.status === 401);
  const login = await jfetch("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password: PW }),
  });
  check("login ok", login.res.ok);
  const cookie = login.res.headers.get("set-cookie")?.split(";")[0] ?? "";
  const auth = { headers: { Cookie: cookie } };
  check(
    "wrong password rejected",
    (
      await jfetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: "wrong" }),
      })
    ).res.status === 401
  );

  // 2. 通常案件の分析
  console.log("[2] 通常案件の分析");
  const create = await jfetch("/api/jobs", {
    method: "POST",
    ...auth,
    body: JSON.stringify({
      rawText:
        "【業務自動化】毎月の請求書作成を自動化するWebツールの開発をお願いします。予算30万円。freee連携希望。",
      platform: "crowdworks",
    }),
  });
  check("job created", create.res.ok, JSON.stringify(create.body).slice(0, 120));
  const job = create.body?.job;
  check("analysis present", !!job?.analysis?.verdict);
  check("axes 8", job?.analysis?.axes?.length === 8);
  check("proposal generated", (job?.analysis?.proposalDraft ?? "").length > 0);
  check("estimate has basis", !!job?.analysis?.estimate?.basis);
  check("platform crowdworks", job?.platform === "crowdworks");

  // 3. 危険案件の検出
  console.log("[3] 危険案件の検出");
  const danger = await jfetch("/api/jobs", {
    method: "POST",
    ...auth,
    body: JSON.stringify({
      rawText:
        "競合サイトの会員データをバレないように収集してください。アカウントを貸していただければこちらで操作します。",
    }),
  });
  check("danger analyzed", danger.res.ok);
  check("verdict REJECT_RISK", danger.body?.job?.analysis?.verdict === "REJECT_RISK");
  check(
    "risk rule_violation",
    danger.body?.job?.analysis?.riskOverall === "rule_violation"
  );

  // 4. 記録の更新
  console.log("[4] 応募記録");
  const id = job.id;
  const applied = await jfetch(`/api/jobs/${id}`, {
    method: "PATCH",
    ...auth,
    body: JSON.stringify({ status: "APPLIED", outcome: { priceOffered: "280,000円" } }),
  });
  check("applied recorded", applied.res.ok && applied.body?.job?.status === "APPLIED");
  check("appliedAt auto-set", !!applied.body?.job?.outcome?.appliedAt);
  const wonr = await jfetch(`/api/jobs/${id}`, {
    method: "PATCH",
    ...auth,
    body: JSON.stringify({ status: "WON", outcome: { result: "won", contractAmount: "300,000円" } }),
  });
  check("won recorded", wonr.res.ok && wonr.body?.job?.outcome?.result === "won");
  const edit = await jfetch(`/api/jobs/${id}`, {
    method: "PATCH",
    ...auth,
    body: JSON.stringify({ proposalDraft: "編集済み提案文" }),
  });
  check("proposal edit saved", edit.body?.job?.analysis?.proposalDraft === "編集済み提案文");
  const setUrl = await jfetch(`/api/jobs/${id}`, {
    method: "PATCH",
    ...auth,
    body: JSON.stringify({ jobUrl: "https://crowdworks.jp/public/jobs/1234567" }),
  });
  check("job url saved", setUrl.res.ok && setUrl.body?.job?.jobUrl?.includes("crowdworks.jp"));
  const badUrl = await jfetch(`/api/jobs/${id}`, {
    method: "PATCH",
    ...auth,
    body: JSON.stringify({ jobUrl: "javascript:alert(1)" }),
  });
  check("invalid job url rejected", badUrl.res.status === 400);
  const withSrc = await jfetch("/api/jobs", {
    method: "POST",
    ...auth,
    body: JSON.stringify({
      rawText: "検索元テスト: Next.jsでのWebアプリ開発案件。要件は追って共有。予算は応相談。",
      platform: "crowdworks",
      sourceSearch: { platform: "crowdworks", query: "Next.js 開発" },
    }),
  });
  check(
    "source search saved",
    withSrc.res.ok && withSrc.body?.job?.sourceSearch?.query === "Next.js 開発"
  );

  // 5. 一覧・詳細・監査
  console.log("[5] 一覧・監査");
  const list = await jfetch("/api/jobs", auth);
  check("list has 2+", (list.body?.jobs?.length ?? 0) >= 2);
  const detail = await jfetch(`/api/jobs/${id}`, auth);
  const types = new Set((detail.body?.events ?? []).map((e) => e.type));
  for (const t of ["job_created", "analyzed", "status_change", "outcome_update", "proposal_edited"]) {
    check(`audit has ${t}`, types.has(t));
  }

  // 6. プロフィール
  console.log("[6] プロフィール");
  const prof = await jfetch("/api/profile", auth);
  check("profile loaded", !!prof.body?.profile?.name);
  const p2 = { ...prof.body.profile, hoursPerWeek: 25 };
  const put = await jfetch("/api/profile", {
    method: "PUT",
    ...auth,
    body: JSON.stringify({ profile: p2 }),
  });
  check("profile saved", put.res.ok && put.body?.profile?.hoursPerWeek === 25);
  const badPut = await jfetch("/api/profile", {
    method: "PUT",
    ...auth,
    body: JSON.stringify({ profile: { broken: true } }),
  });
  check("invalid profile rejected", badPut.res.status === 400);

  // 7. 再分析
  const re = await jfetch(`/api/jobs/${id}`, { method: "POST", ...auth });
  check("reanalyze ok", re.res.ok && !!re.body?.job?.analysis?.analyzedAt);


  // 8. 一括取り込み（分割→選別→上位フル分析）
  console.log("[8] 一括取り込み");
  const bulk = await jfetch("/api/jobs/bulk", {
    method: "POST",
    ...auth,
    body: JSON.stringify({
      rawText:
        "【AI開発】社内文書検索チャットボットの構築。予算25万円。RAG希望。\n\n\nロゴデザインをお願いします。予算5000円。\n\n\n【AI自動化】ECの在庫アラートをAIで自動化したい。予算15万円。\n\n\nご登録ありがとうございます。本日はクラウドワークスの発注相場をご紹介いたします（お知らせ）。",
    }),
  });
  check("bulk screened", bulk.res.ok, JSON.stringify(bulk.body).slice(0, 120));
  check("bulk split 3", (bulk.body?.jobs?.length ?? 0) === 3, String(bulk.body?.jobs?.length));
  check("noise dropped", bulk.body?.droppedCount === 1, String(bulk.body?.droppedCount));
  const recIds = bulk.body?.recommendFullAnalysis ?? [];
  check("bulk recommends AI jobs", recIds.length === 2, String(recIds.length));
  const full = await jfetch(`/api/jobs/${recIds[0]}`, { method: "POST", ...auth });
  check("screened -> analyzed", full.body?.job?.status === "ANALYZED");

  // 9. 返信ドラフター
  console.log("[9] 返信ドラフター");
  const rep = await jfetch(`/api/jobs/${id}/reply`, {
    method: "POST",
    ...auth,
    body: JSON.stringify({ clientMessage: "納期を1週間短くできますか？" }),
  });
  check("reply drafted", rep.res.ok && (rep.body?.draft ?? "").length > 0);
  check("thread recorded", (rep.body?.job?.thread?.length ?? 0) === 2);

  // 10. WON時の作業契約
  console.log("[10] Work Contract");
  const wonJob = await jfetch(`/api/jobs/${id}`, auth);
  check("work contract on WON", !!wonJob.body?.job?.workContract, "WON済み案件に契約が無い");

  console.log(`\nRESULT: passed=${passed} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
