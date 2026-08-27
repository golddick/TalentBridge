import { NextResponse } from "next/server";
import { z } from "zod";
import { sendOtp } from "@/lib/dropaphi-otp";

const schema = z.object({ email: z.string().email() });

// Simple in-memory throttle for the prototype: one request per email per 30s.
// A production deployment would move this to Redis so it works across instances.
const lastRequestAt = new Map<string, number>();

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  const last = lastRequestAt.get(email);
  if (last && Date.now() - last < 30_000) {
    return NextResponse.json(
      { error: "Please wait before requesting another code." },
      { status: 429 }
    );
  }
  lastRequestAt.set(email, Date.now());

  try {
    await sendOtp(email);
  } catch (err: any) {
    console.error("DropAphi send OTP failed:", err);
    return NextResponse.json(
      { error: "Could not send a sign-in code right now. Please try again shortly." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
