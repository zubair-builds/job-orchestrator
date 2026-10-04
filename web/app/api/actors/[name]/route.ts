import { NextResponse } from "next/server";
import { getActor } from "@/lib/actors/registry";
import { tokenOk, unauthorized } from "@/lib/actors/auth";

export async function GET(request: Request, { params }: { params: { name: string } }) {
  if (!tokenOk(request)) return unauthorized();
  const actor = getActor(params.name);
  if (!actor) return NextResponse.json({ error: "Actor not found" }, { status: 404 });
  return NextResponse.json(actor);
}
