"use client";

// 案件の削除ボタン（誤タップ防止の2度押し方式・3秒で元に戻る）
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteJobButton({ id }: { id: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function onClick(e: React.MouseEvent) {
    // 親のLink遷移を止める
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!arming) {
      setArming(true);
      timer.current = setTimeout(() => setArming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else setArming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={arming ? "もう一度タップで削除（取り消し不可）" : "この案件を削除"}
      className={`shrink-0 rounded-lg px-2 py-1 text-xs transition-colors ${
        arming
          ? "bg-red-600 text-white"
          : "text-neutral-300 hover:bg-red-50 hover:text-red-600"
      }`}
    >
      {busy ? "…" : arming ? "削除する" : "✕"}
    </button>
  );
}
