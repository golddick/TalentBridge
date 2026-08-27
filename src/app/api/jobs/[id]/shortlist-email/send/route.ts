import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/dropaphi-email";

const schema = z.object({
  applicationIds: z.array(z.string()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

/**
 * Sends a recruiter-authored (or AI-drafted-then-edited) email to the
 * selected shortlisted candidates via DropAphi. Only ever operates on
 * applications that belong to this job and are currently SHORTLISTED —
 * a recruiter can't accidentally email candidates who were never
 * shortlisted for this role. Every send is written to that application's
 * audit trail.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const recruiterId = (session?.user as any)?.id as string | undefined;
  if (!recruiterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const applications = await prisma.application.findMany({
    where: {
      id: { in: parsed.data.applicationIds },
      jobId: params.id,
      status: "SHORTLISTED",
    },
    include: { candidate: true },
  });

  const htmlBody = parsed.data.body
    .split(/\n\s*\n/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  const results: { applicationId: string; candidateName: string; sent: boolean; error?: string }[] = [];

  for (const application of applications) {
    const email = application.candidate.email;
    if (!email) {
      results.push({
        applicationId: application.id,
        candidateName: application.candidate.name,
        sent: false,
        error: "No email on file for this candidate.",
      });
      continue;
    }

    try {
      await sendEmail({
        to: email,
        subject: parsed.data.subject,
        html: htmlBody,
        text: parsed.data.body,
        fromName: "TalentBridge",
      });

      await prisma.auditLog.create({
        data: {
          applicationId: application.id,
          actorId: recruiterId,
          action: "Recruiter sent shortlist email",
          metadata: { subject: parsed.data.subject },
        },
      });

      results.push({ applicationId: application.id, candidateName: application.candidate.name, sent: true });
    } catch (err: any) {
      console.error(`Failed to send shortlist email for application ${application.id}:`, err);
      results.push({
        applicationId: application.id,
        candidateName: application.candidate.name,
        sent: false,
        error: "Send failed.",
      });
    }
  }

  return NextResponse.json({ results });
}
