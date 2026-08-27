import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractCvText } from "@/lib/cvText";
import { runQualificationPipeline } from "@/lib/pipeline";

/**
 * Re-runs extraction + evaluation for an existing application — useful after
 * a recruiter edits job requirements/weights and wants candidates re-scored.
 * Re-downloads the CV from its stored DropAphi URL.
 *
 * Access: signed-in staff only, and only for applications belonging to their
 * own organization (SUPERADMIN excepted). This endpoint both spends money (two
 * AI calls per run) and overwrites an existing Evaluation, so it must not be
 * reachable by applicants or by anyone who merely knows an application ID.
 */
const STAFF_ROLES = ["RECRUITER", "HIRING_MANAGER", "ADMIN", "SUPERADMIN"];

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const actorId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;

  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Checked before the application is looked up, so an applicant probing IDs
  // can't distinguish "exists" from "doesn't exist" via the status code.
  if (!role || !STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const application = await prisma.application.findUnique({
    where: { id: params.id },
    include: { job: { select: { organizationId: true } } },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  // Org scoping: a recruiter at one organization must not be able to re-process
  // (or spend AI budget on) another organization's candidates. The JWT carries
  // only id/role, so the organization comes from the User record.
  if (role !== "SUPERADMIN") {
    const user = await prisma.user.findUnique({
      where: { id: actorId },
      select: { organizationId: true },
    });
    if (!user?.organizationId || user.organizationId !== application.job.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const fileRes = await fetch(application.cvUrl);
  if (!fileRes.ok) {
    return NextResponse.json({ error: "Could not retrieve the stored CV file." }, { status: 502 });
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  // DropAphi URLs carry no file extension, so this name is usually just an
  // opaque file ID — extractCvText falls back to sniffing the file's bytes.
  const filename = new URL(application.cvUrl).pathname.split("/").pop() || "cv";

  const cvText = await extractCvText(buffer, filename);

  await prisma.auditLog.create({
    data: {
      applicationId: application.id,
      actorId,
      action: "Re-ran AI qualification",
    },
  });

  const result = await runQualificationPipeline(application.id, cvText);

  return NextResponse.json({ ok: true, ...result });
}
