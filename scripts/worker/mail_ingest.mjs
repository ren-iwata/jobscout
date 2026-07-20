// メール自動取り込み（v0.3・①の消滅）
// Gmailの「jobscout」ラベル（プラットフォーム通知メールを振り分け）をIMAPで読み、
// 本文を本番APIの一括取り込み（/api/jobs/bulk）へ渡し、上位をフル分析まで自動実行する。
// 読むのは利用者自身の受信箱のみ（プラットフォームへの自動アクセスは行わない＝規約適合）。
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const BASE = (process.env.JOBSCOUT_BASE_URL ?? "https://jobscout-nine.vercel.app").replace(/\/$/, "");

async function apiLogin() {
  const pw = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (!pw) throw new Error("ADMIN_PASSWORD がない");
  const r = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pw }),
  });
  if (!r.ok) throw new Error(`API login failed: ${r.status}`);
  return r.headers.get("set-cookie")?.split(";")[0] ?? "";
}

export async function runMailIngest(payload) {
  const user = (process.env.GMAIL_USER ?? "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD ?? "").trim();
  if (!user || !pass) {
    return { skipped: true, note: "GMAIL_USER / GMAIL_APP_PASSWORD 未設定（CEOの一回設定待ち）" };
  }
  const label = payload?.label ?? "jobscout";
  const maxMails = payload?.maxMails ?? 10;

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  const summary = { mails: 0, jobsCreated: 0, analyzed: 0, errors: [], mailboxes: [] };
  try {
    // 取りこぼし防止のため両方を読む:
    //  1) INBOX（Upwork/CrowdWorksの差出人のみ・振り分け設定が無くても拾う）
    //  2) ラベル（あれば。振り分け済みでINBOXをスキップした通知を拾う）
    const passes = [
      { box: "INBOX", criteria: { seen: false, or: [{ from: "upwork" }, { from: "crowdworks" }] } },
      { box: label, criteria: { seen: false } },
    ];
    const targetsAll = [];
    for (const p of passes) {
      try {
        await client.mailboxOpen(p.box);
      } catch {
        continue;
      }
      const unseen = await client.search(p.criteria);
      const t = (unseen ?? []).slice(-maxMails);
      summary.mailboxes.push(`${p.box}:${t.length}`);
      for (const uid of t) targetsAll.push({ box: p.box, uid });
    }
    if (targetsAll.length === 0) return { ...summary, note: "新着なし" };

    const cookie = await apiLogin();
    const auth = { Cookie: cookie, "Content-Type": "application/json" };

    for (const { box, uid } of targetsAll) {
      await client.mailboxOpen(box);
      try {
        const msg = await client.fetchOne(uid, { source: true });
        const parsed = await simpleParser(msg.source);
        const text = (parsed.text ?? "").trim() || (parsed.html ?? "").replace(/<[^>]+>/g, " ");
        if (text.length < 60) {
          await client.messageFlagsAdd(uid, ["\\Seen"]);
          continue;
        }
        // 明白な運営メール（登録通知・メルマガ・広告等）は選別AIに掛けず既読スキップ
        const subject = parsed.subject ?? "";
        if (
          /ご登録(ありがとう|完了)|メールマガジン|メルマガ|発注相場|キャンペーン|アンケート|利用ガイド|お知らせ/.test(
            subject
          )
        ) {
          await client.messageFlagsAdd(uid, ["\\Seen"]);
          summary.skippedPromo = (summary.skippedPromo ?? 0) + 1;
          continue;
        }
        summary.mails++;
        const bulk = await fetch(`${BASE}/api/jobs/bulk`, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ rawText: `【通知メール取り込み】From: ${parsed.from?.text ?? ""} / Subject: ${parsed.subject ?? ""}\n\n${text.slice(0, 50000)}` }),
        });
        const data = await bulk.json();
        if (!bulk.ok) {
          // 案件が検出できないメール（お知らせ等）は既読にして流す
          if (bulk.status === 422) {
            await client.messageFlagsAdd(uid, ["\\Seen"]);
            continue;
          }
          throw new Error(data.error ?? `bulk failed ${bulk.status}`);
        }
        summary.jobsCreated += data.jobs?.length ?? 0;
        for (const id of data.recommendFullAnalysis ?? []) {
          const full = await fetch(`${BASE}/api/jobs/${id}`, { method: "POST", headers: auth });
          if (full.ok) summary.analyzed++;
        }
        await client.messageFlagsAdd(uid, ["\\Seen"]);
      } catch (e) {
        summary.errors.push(String(e).slice(0, 150));
      }
    }
  } finally {
    await client.logout().catch(() => null);
  }
  return summary;
}
