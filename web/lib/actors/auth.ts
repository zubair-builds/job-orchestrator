import { NextResponse } from "next/server";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function tokenOk(request: Request) {
  const expected = process.env.MCP_TOKEN;
  if (!expected) return true;
  const header = request.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-mcp-token") || "";
  return bearer === expected || alt === expected;
}
