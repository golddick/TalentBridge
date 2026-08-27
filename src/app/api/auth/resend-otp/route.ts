import { NextResponse } from "next/server";
import { z } from "zod";
import { resendOtp } from "@/lib/dropaphi-otp";

const schema = z.object({ email: z.string().email(), reason: z.string().optional() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    await resendOtp(parsed.data.email.toLowerCase().trim(), parsed.data.reason || "not_received");
  } catch (err: any) {
    console.error("DropAphi resend OTP failed:", err);
    return NextResponse.json({ error: "Could not resend the code. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
