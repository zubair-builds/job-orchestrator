import { NextResponse } from "next/server";
import { getActor } from "@/lib/actors/registry";
import { parseLinkedInInput, startLinkedInRun } from "@/lib/actors/run";
import { tokenOk, unauthorized } from "@/lib/actors/auth";

export async function POST(request: Request, { params }: { params: { name: string } }) {
  if (!tokenOk(request)) return unauthorized();
  const actor = getActor(params.name);
  if (!actor) return NextResponse.json({ error: "Actor not found" }, { status: 404 });
  if (actor.name !== "linkedin-jobs") {
    return NextResponse.json({ error: "Actor is not runnable yet" }, { status: 400 });
  }

  const parsed = parseLinkedInInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await startLinkedInRun(parsed.input);
  return NextResponse.json(result, { status: result.status === "FAILED" ? 502 : 202 });
}
