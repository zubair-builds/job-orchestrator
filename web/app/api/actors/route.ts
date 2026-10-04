import { NextResponse } from "next/server";
import { actors } from "@/lib/actors/registry";
import { tokenOk, unauthorized } from "@/lib/actors/auth";

export async function GET(request: Request) {
  if (!tokenOk(request)) return unauthorized();
  return NextResponse.json({
    actors: actors.map((actor) => ({
      name: actor.name,
      title: actor.title,
      description: actor.description,
    })),
  });
}
