import { NextResponse } from "next/server";
import { getRizzbotReply } from "@/lib/rizzbot";
import type { RizzProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequest = {
  matchId?: string;
  profile?: RizzProfile;
  message?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatRequest;

  if (!body.matchId || !body.profile || !body.message?.trim()) {
    return NextResponse.json({ error: "matchId, profile, and message are required." }, { status: 400 });
  }

  const reply = await getRizzbotReply({
    matchId: body.matchId,
    profile: body.profile,
    text: body.message.trim(),
  });

  return NextResponse.json(reply);
}
