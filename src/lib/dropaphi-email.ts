const DROPAPHI_BASE_URL = process.env.DROPAPHI_BASE_URL || "https://dropaphi.xyz/api/v1";

function apiKey() {
  const key = process.env.DROPAPHI_API_KEY;
  if (!key) throw new Error("DROPAPHI_API_KEY is not configured.");
  return key;
}

type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  fromName?: string;
};

/**
 * Sends a transactional email via DropAphi's general email API
 * (POST /email/send) — distinct from the OTP-specific endpoints in
 * dropaphi-otp.ts, which cover sign-in codes only. Used for things like
 * organization invites, which need a normal HTML email rather than a code.
 */
export async function sendEmail(input: SendEmailInput) {
  const res = await fetch(`${DROPAPHI_BASE_URL}/email/send`, {
    method: "POST",
    headers: {
      "DROP-API-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      template: input.template,
      templateData: input.templateData,
      fromName: input.fromName || "TalentBridge",
      tracking: { opens: true, clicks: true },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `DropAphi email send failed (${res.status})`);
  }
  return data;
}

/**
 * Sends the organization-invite email a Super Admin triggers when creating
 * a new organization. The recipient signs in with the normal Email OTP flow
 * — this email just tells them the org exists and gives them a link.
 */
export async function sendOrganizationInviteEmail({
  to,
  organizationName,
  inviterName,
  signInUrl,
}: {
  to: string;
  organizationName: string;
  inviterName?: string;
  signInUrl: string;
}) {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h1 style="font-size:20px;">You've been added to ${organizationName} on TalentBridge</h1>
      <p>${inviterName ? `${inviterName} has` : "TalentBridge has"} set up <strong>${organizationName}</strong>
      as a new organization, and you've been added as its first recruiter.</p>
      <p>Sign in with this email address to get started — no password needed,
      just a one-time code sent to your inbox:</p>
      <p><a href="${signInUrl}" style="display:inline-block;background:#1F6F6F;color:#fff;
      padding:10px 18px;border-radius:6px;text-decoration:none;">Sign in to TalentBridge</a></p>
      <p style="color:#6B7280;font-size:13px;">Qualify first. Hire smarter.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `You've been added to ${organizationName} on TalentBridge`,
    html,
    text: `${organizationName} has been created on TalentBridge and you've been added as a recruiter. Sign in at ${signInUrl} using this email address — no password needed.`,
    template: "organization-invite",
    templateData: { organizationName, inviterName, signInUrl },
    fromName: "TalentBridge",
  });
}

/**
 * Sends the confirmation email for a recruiter who signed themselves up at
 * /signup and created their own organization — the self-service counterpart
 * to sendOrganizationInviteEmail above. By the time this runs the recruiter
 * is already verified and signed in, so it confirms what was created and
 * points at the next step (posting a job) rather than asking them to sign in.
 */
export async function sendOrganizationWelcomeEmail({
  to,
  organizationName,
  recruiterName,
  dashboardUrl,
}: {
  to: string;
  organizationName: string;
  recruiterName?: string;
  dashboardUrl: string;
}) {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h1 style="font-size:20px;">${organizationName} is live on TalentBridge</h1>
      <p>${recruiterName ? `Welcome, ${recruiterName}. ` : "Welcome. "}Your organization
      <strong>${organizationName}</strong> has been created and you're set up as its first recruiter.</p>
      <p>Next step: post your first role. TalentBridge will turn the job description into
      structured requirements, then score every CV against them with cited evidence.</p>
      <p><a href="${dashboardUrl}" style="display:inline-block;background:#1F6F6F;color:#fff;
      padding:10px 18px;border-radius:6px;text-decoration:none;">Post your first job</a></p>
      <p style="color:#6B7280;font-size:13px;">You can sign in any time with this email address —
      using your password, or a one-time code sent to your inbox.</p>
      <p style="color:#6B7280;font-size:13px;">Qualify first. Hire smarter.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `${organizationName} is live on TalentBridge`,
    html,
    text: `Your organization ${organizationName} has been created on TalentBridge and you're set up as its first recruiter. Post your first job at ${dashboardUrl}.`,
    template: "organization-welcome",
    templateData: { organizationName, recruiterName, dashboardUrl },
    fromName: "TalentBridge",
  });
}
