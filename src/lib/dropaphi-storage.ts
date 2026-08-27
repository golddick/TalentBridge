const DROPAPHI_BASE_URL = process.env.DROPAPHI_BASE_URL || "https://dropaphi.xyz/api/v1";

function apiKey() {
  const key = process.env.DROPAPHI_API_KEY;
  if (!key) throw new Error("DROPAPHI_API_KEY is not configured.");
  return key;
}

/**
 * Uploads a file to DropAphi and returns its public URL. The rest of the
 * platform only ever stores/reads this URL — nothing else talks to DropAphi
 * directly (project doc §17.7, updated to use DropAphi in place of Dropbox).
 */
export async function uploadFileToDropAphi(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = "cvs"
): Promise<{ url: string; id?: string }> {
  const res = await fetch(`${DROPAPHI_BASE_URL}/files/upload`, {
    method: "POST",
    headers: {
      "DROP-API-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: filename,
      type: contentType,
      data: buffer.toString("base64"),
      metadata: { visibility: "PUBLIC", folder },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DropAphi upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  // DropAphi is expected to return the hosted file URL — field name kept
  // flexible in case the API responds with `url` or nested under `file`.
  const url: string | undefined = data.url || data.file?.url || data.data?.url;
  if (!url) throw new Error("DropAphi upload response did not include a file URL.");

  return { url, id: data.id || data.file?.id };
}
