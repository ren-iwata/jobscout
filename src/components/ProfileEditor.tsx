"use client";

// プロフィール編集（v0.1はJSONエディタ方式・検証付き）
import { useEffect, useState } from "react";

export default function ProfileEditor() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setText(JSON.stringify(d.profile, null, 2)))
      .catch(() => setNotice("読み込みに失敗しました"));
  }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  }

  async function save() {
    setBusy(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("JSONの形式が不正です（カンマや括弧を確認）");
      }
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存に失敗しました");
      setText(JSON.stringify(data.profile, null, 2));
      showNotice("保存しました。以後の分析に反映されます");
    } catch (e) {
      showNotice(`⚠ ${e instanceof Error ? e.message : "保存に失敗しました"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-4 pb-20">
      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}
      <h1 className="text-lg font-bold">プロフィール（Freelancer Profile Model）</h1>
      <p className="text-xs text-neutral-500">
        判断・見積もり・提案文の全てがこのプロフィールを基準にします。単価（dayRateJpyRange）・
        実績（evidence）・戦略（strategy）を実態に合わせて更新してください。
      </p>
      <textarea
        className="af-input min-h-[32rem] font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button className="af-btn-primary" disabled={busy || !text} onClick={save}>
          保存する
        </button>
        <button
          className="af-btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  kind: "capability_scan",
                  payload: {
                    githubUsers: ["ren-iwata"],
                    urls: [
                      "https://agentfront-claude.vercel.app",
                      "https://jobscout-nine.vercel.app",
                      "https://loop-delta-nine.vercel.app",
                    ],
                  },
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "登録に失敗しました");
              showNotice(`成果物スキャンを予約しました（${data.note}）`);
            } catch (e) {
              showNotice(`⚠ ${e instanceof Error ? e.message : "登録に失敗しました"}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          成果物からプロフィールを自動更新（バックグラウンド）
        </button>
      </div>
    </main>
  );
}
