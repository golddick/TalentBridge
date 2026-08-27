import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { parseJobDescription } from "@/lib/openai";

const schema = z.object({ description: z.string().min(20) });

/**
 * Runs the Job Parser AI service on demand from the "New job" form, so a
 * recruiter can click a button and see generated requirements appear in the
 * editable list before the job is even created — rather than requirements
 * only ever being generated silently at submit time. The API key stays
 * server-side; this route is the only thing the client talks to.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A job description of at least 20 characters is required." },
      { status: 400 }
    );
  }

  try {
    const result = await parseJobDescription(parsed.data.description);
    return NextResponse.json({ requirements: result.requirements || [] });
  } catch (err: any) {
    console.error("On-demand job parsing failed:", err);
    return NextResponse.json(
      { error: "Couldn't generate requirements right now. Please try again or add them manually." },
      { status: 502 }
    );
  }
}
