import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const profiles = await prisma.searchProfile.findMany({
      orderBy: { searchTerm: "asc" },
      include: { scrapeRuns: { orderBy: { startTime: "desc" }, take: 1 } },
    });
    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.searchTerm || !body.location) {
      return NextResponse.json({ error: "Missing searchTerm or location" }, { status: 400 });
    }

    const profile = await prisma.searchProfile.create({
      data: {
        searchTerm: body.searchTerm,
        location: body.location,
        remote: body.remote || false,
        platforms: body.platforms || [],
        jobTypes: body.jobTypes || [],
        hoursOld: body.hoursOld || 24,
        country: body.country || null,
        easyApply: body.easyApply || false,
        deepScrape: body.deepScrape ?? true,
        resultsWanted: body.resultsWanted || 10,
        isActive: body.isActive ?? true,
      },
    });
    
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating profile:", error);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
}
