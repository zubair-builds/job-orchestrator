import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { jobHash, listingFromJobSpy } from "@/lib/actors/normalize";

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  const expected = process.env.WEBHOOK_SECRET || "default_secret_for_dev";
  if (secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const runId = typeof payload.run_id === "string" ? payload.run_id : "";
  const status = typeof payload.status === "string" ? payload.status : "SUCCEEDED";
  const actor = typeof payload.actor === "string" ? payload.actor : "linkedin-jobs";

  if (runId && status === "FAILED") {
    await prisma.actorRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: String(payload.error || "scraper failed"),
        log: String(payload.error || "scraper failed"),
      },
    }).catch(() => null);
    return NextResponse.json({ ok: true, status: "FAILED" });
  }

  const rows = Array.isArray(payload.jobs) ? payload.jobs : [];
  let stored = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const listing = listingFromJobSpy(row as Record<string, unknown>, "linkedin");
    if (!listing) continue;
    if (actor === "linkedin-jobs" && listing.platform.toLowerCase() !== "linkedin") continue;

    const hash = jobHash(listing.company, listing.title, listing.location || "");
    const job = await prisma.job.upsert({
      where: { job_hash: hash },
      update: {
        description: listing.description || undefined,
        missedRuns: 0,
      },
      create: {
        job_hash: hash,
        title: listing.title,
        company: listing.company,
        location: listing.location,
        description: listing.description,
      },
    });
    const existingSource = await prisma.jobSource.findFirst({
      where: { jobId: job.id, url: listing.url },
    });
    if (!existingSource) {
      await prisma.jobSource.create({
        data: { jobId: job.id, url: listing.url, platform: listing.platform },
      });
    }

    if (runId) {
      const run = await prisma.actorRun.findUnique({ where: { id: runId } });
      if (run) {
        await prisma.datasetItem.create({
          data: {
            datasetId: run.datasetId,
            runId: run.id,
            data: { ...listing, jobId: job.id } as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
    stored += 1;
  }

  if (runId) {
    await prisma.actorRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        jobsFound: stored,
        log: `stored ${stored} listings`,
      },
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, stored });
}
