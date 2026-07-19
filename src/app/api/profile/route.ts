import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { loadProfile, saveProfile } from "@/lib/profile";
import type { FreelancerProfile } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ profile: await loadProfile() });
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { profile?: FreelancerProfile };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const p = body.profile;
  if (!p || typeof p !== "object" || !p.name || !Array.isArray(p.evidence)) {
    return NextResponse.json(
      { error: "プロフィールの形式が不正です（name・evidenceは必須）" },
      { status: 400 }
    );
  }
  await saveProfile(p);
  return NextResponse.json({ profile: await loadProfile() });
}
