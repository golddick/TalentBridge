const DROPAPHI_BASE_URL = process.env.DROPAPHI_BASE_URL || "https://dropaphi.xyz/api/v1";

function apiKey() {
  const key = process.env.DROPAPHI_API_KEY;
  if (!key) throw new Error("DROPAPHI_API_KEY is not configured.");
  return key;
}

async function dropaphiRequest(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${DROPAPHI_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "DROP-API-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `DropAphi request to ${path} failed (${res.status})`);
  }
  return data;
}

/**
 * Sends a one-time sign-in code to the given email via DropAphi's OTP
 * service. DropAphi generates, stores, and delivers the code itself —
 * TalentBridge never sees or stores the raw code (project doc §17.8,
 * updated to use DropAphi OTP in place of a self-hosted code + SMTP flow).
 */
export async function sendOtp(email: string) {
  return dropaphiRequest("/otp/send", {
    email,
    length: 6,
    expiry: 10, // minutes
    brandName: "TalentBridge",
  });
}

/**
 * Verifies a code the user entered. Returns true only if DropAphi confirms
 * the code is valid, unexpired, and unused for this email.
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
  try {
    const data = await dropaphiRequest("/otp/verify", { email, code });
    return data?.success === true || data?.verified === true || data?.valid === true;
  } catch {
    return false;
  }
}

/**
 * Requests a fresh code when the user didn't receive the original one.
 */
export async function resendOtp(email: string, reason: string = "not_received") {
  return dropaphiRequest("/otp/resend", {
    email,
    reason,
    length: 6,
    expiry: 10,
  });
}
