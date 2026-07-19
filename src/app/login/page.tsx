"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function login() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ログインに失敗しました");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました");
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <div className="af-card p-6">
        <p className="text-xs font-semibold tracking-widest text-blue-600 mb-1">
          JOBSCOUT
        </p>
        <h1 className="text-lg font-bold mb-4">オーナーログイン</h1>
        <label className="af-label">パスワード</label>
        <input
          type="password"
          className="af-input mb-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <button
          className="af-btn-primary w-full"
          onClick={login}
          disabled={!password || sending}
        >
          ログイン
        </button>
      </div>
    </main>
  );
}
