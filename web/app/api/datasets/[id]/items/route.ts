import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tokenOk, unauthorized } from "@/lib/actors/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!tokenOk(request)) return unauthorized();
  const url = new URL(request.url);
  const limit = clamp(url.searchParams.get("limit"), 20, 1, 100);
  const offset = clamp(url.searchParams.get("offset"), 0, 0, 10_000);
  const fields = (url.searchParams.get("fields") || "")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  const run = await prisma.actorRun.findUnique({ where: { datasetId: params.id } });
  if (!run) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

  const [total, items] = await Promise.all([
    prisma.datasetItem.count({ where: { datasetId: params.id } }),
    prisma.datasetItem.findMany({
      where: { datasetId: params.id },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    datasetId: params.id,
    runId: run.id,
    total,
    offset,
    limit,
    items: items.map((item) => pick(item.data, fields)),
  });
}

function clamp(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function pick(data: unknown, fields: string[]) {
  if (!fields.length || !data || typeof data !== "object") return data;
  const row = data as Record<string, unknown>;
  return Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]]));
}
