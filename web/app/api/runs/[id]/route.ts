import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tokenOk, unauthorized } from "@/lib/actors/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!tokenOk(request)) return unauthorized();
  const run = await prisma.actorRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json({
    runId: run.id,
    actorName: run.actorName,
    status: run.status,
    datasetId: run.datasetId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    jobsFound: run.jobsFound,
    errorMessage: run.errorMessage,
    log: run.log,
    input: run.input,
  });
}
