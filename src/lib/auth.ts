// 管理画面の簡易認証（v0.1: 単一オーナー・パスワード＋署名cookie）
import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "js_admin";

function adminPassword(): string {
  // trim: Secrets登録時の改行混入への防御
  return (process.env.ADMIN_PASSWORD || "change-me").trim();
}

export function adminToken(): string {
  return crypto
    .createHash("sha256")
    .update(`jobscout-v01:${adminPassword()}`)
    .digest("hex");
}

export function checkPassword(pw: string): boolean {
  const a = Buffer.from(pw);
  const b = Buffer.from(adminPassword());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const v = store.get(COOKIE_NAME)?.value;
  return !!v && v === adminToken();
}

export const ADMIN_COOKIE = COOKIE_NAME;
