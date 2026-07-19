import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/login");
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm font-bold">
          JobScout <span className="text-blue-600">案件獲得エージェント</span>
        </Link>
        <nav className="flex gap-3 text-xs text-neutral-500">
          <Link href="/new" className="underline">
            新規分析
          </Link>
          <Link href="/profile" className="underline">
            プロフィール
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
