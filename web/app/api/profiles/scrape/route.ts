import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { profileId } = await request.json();
    
    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const profile = await prisma.searchProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Map Prisma profile to Python scraper expected payload
    const scraperPayload = {
      search_term: profile.searchTerm,
      location: profile.location,
      site_name: profile.platforms?.length > 0 ? profile.platforms : ["linkedin", "indeed", "glassdoor"],
      results_wanted: profile.resultsWanted,
      hours_old: profile.hoursOld,
      job_type: profile.jobTypes?.length > 0 ? profile.jobTypes : null,
      country_indeed: profile.country || null,
      easy_apply: profile.easyApply,
      linkedin_fetch_description: profile.deepScrape,
      is_remote: profile.remote
    };

    const res = await fetch("http://localhost:8000/api/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scraper-secret": process.env.SCRAPER_SECRET || "default_secret_for_dev"
      },
      body: JSON.stringify(scraperPayload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Scraper API error:", errorText);
      return NextResponse.json({ error: "Failed to trigger scraper API" }, { status: 500 });
    }

    // Record a new scrape run
    await prisma.scrapeRun.create({
      data: {
        profileId: profile.id,
        status: "PENDING",
      }
    });

    return NextResponse.json({ status: "Scrape triggered successfully" }, { status: 202 });
  } catch (error) {
    console.error("Error triggering scrape:", error);
    return NextResponse.json({ error: "Failed to trigger scrape" }, { status: 500 });
  }
}
