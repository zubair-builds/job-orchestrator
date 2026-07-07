import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { cvText } = await req.json();

    if (!cvText) {
      return NextResponse.json({ error: "No CV text provided" }, { status: 400 });
    }

    // Save the resume to the database
    const newResume = await prisma.userResume.create({
      data: {
        content: cvText,
        skills: [],
      }
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            core_skills: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            },
            suggested_job_titles: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            },
            recommended_search_profiles: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  searchTerm: { type: SchemaType.STRING },
                  location: { type: SchemaType.STRING },
                  rationale: { type: SchemaType.STRING }
                },
                required: ["searchTerm", "location", "rationale"]
              }
            }
          },
          required: ["core_skills", "suggested_job_titles", "recommended_search_profiles"]
        }
      }
    });

    const prompt = `You are an expert technical recruiter. Analyze the following CV and extract the core skills, suggest the best job titles, and recommend 3-5 search profiles (keywords and location, e.g. "React Developer", "Remote") to scrape job boards for.\n\nCV:\n${cvText}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text);

    // Update the saved resume with extracted skills and full AI response
    await prisma.userResume.update({
      where: { id: newResume.id },
      data: { 
        skills: data.core_skills,
        aiResponse: data 
      }
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("CV Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
