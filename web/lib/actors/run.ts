import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getActor } from "@/lib/actors/registry";

export type LinkedInInput = {
  search_term: string;
  location: string;
  results_wanted: number;
  hours_old: number;
  is_remote: boolean;
  linkedin_fetch_description: boolean;
  fixture: boolean;
};

export function parseLinkedInInput(body: unknown): { ok: true; input: LinkedInInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Input must be an object" };
  const raw = body as Record<string, unknown>;
  const search_term = typeof raw.search_term === "string" ? raw.search_term.trim() : "";
  const location = typeof raw.location === "string" ? raw.location.trim() : "";
  if (!search_term) return { ok: false, error: "search_term is required" };
  if (!location) return { ok: false, error: "location is required" };
  return {
    ok: true,
    input: {
      search_term,
      location,
      results_wanted: clampInt(raw.results_wanted, 10, 1, 50),
      hours_old: clampInt(raw.hours_old, 24, 1, 720),
      is_remote: Boolean(raw.is_remote),
      linkedin_fetch_description: Boolean(raw.linkedin_fetch_description),
      fixture: Boolean(raw.fixture),
    },
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export async function startLinkedInRun(input: LinkedInInput) {
  const actor = getActor("linkedin-jobs");
  if (!actor) throw new Error("linkedin-jobs is not registered");

  const datasetId = `ds_${crypto.randomUUID().replace(/-/g, "")}`;
  const run = await prisma.actorRun.create({
    data: {
      actorName: actor.name,
      status: "RUNNING",
      input: input as unknown as Prisma.InputJsonValue,
      datasetId,
      log: "run created",
    },
  });

  const scraperUrl = process.env.SCRAPER_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${scraperUrl}/api/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scraper-secret": process.env.SCRAPER_SECRET || "default_secret_for_dev",
      },
      body: JSON.stringify({
        actor: "linkedin-jobs",
        run_id: run.id,
        search_term: input.search_term,
        location: input.location,
        results_wanted: input.results_wanted,
        hours_old: input.hours_old,
        is_remote: input.is_remote,
        linkedin_fetch_description: input.linkedin_fetch_description,
        fixture: input.fixture,
        site_name: ["linkedin"],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return failRun(run.id, `scraper rejected start: ${res.status} ${detail.slice(0, 300)}`);
    }
    await prisma.actorRun.update({
      where: { id: run.id },
      data: { log: "scraper accepted" },
    });
    return { runId: run.id, datasetId: run.datasetId, status: "RUNNING" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "scraper unreachable";
    return failRun(run.id, message);
  }
}

async function failRun(id: string, errorMessage: string) {
  const run = await prisma.actorRun.update({
    where: { id },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage,
      log: errorMessage,
    },
  });
  return { runId: run.id, datasetId: run.datasetId, status: "FAILED", error: errorMessage };
}
