import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const activeResume = await prisma.userResume.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeResume) {
      return NextResponse.json({ cvText: "", analysisResult: null });
    }

    return NextResponse.json({
      cvText: activeResume.content,
      analysisResult: activeResume.aiResponse || null
    });
  } catch (error: any) {
    console.error("Fetch Latest CV Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
