import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFileToDropAphi } from "@/lib/dropaphi-storage";

/**
 * Generic authenticated file upload endpoint, used by the CV Builder and any
 * other feature that needs to store a document and get back a URL (project
 * doc §14 / §19). Distinct from /api/jobs/:id/applications, which is the
 * bulk recruiter CV-intake path and also runs the qualification pipeline.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const folder = (formData.get("folder") as string) || "documents";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { url } = await uploadFileToDropAphi(buffer, file.name, file.type, folder);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err: any) {
    console.error("DropAphi upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
