import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { verifyOtp } from "./dropaphi-otp";
import { sendOrganizationWelcomeEmail } from "./dropaphi-email";
import { hashPassword, isPasswordValid, verifyPassword } from "./password";

/**
 * NextAuth (Auth.js) with three sign-in methods:
 *
 *   - "otp": email code, backed by DropAphi's hosted OTP service. No
 *     password is required. This remains the default/only method until a
 *     user sets a password (see /account and set-password/route.ts).
 *   - "password": email + password, for users who've opted to set one after
 *     their first OTP sign-in. TalentBridge stores only a bcrypt hash,
 *     never the plaintext password, and never asks DropAphi about it —
 *     this path doesn't touch DropAphi at all.
 *   - "signup": recruiter self-service sign-up from /signup. Same OTP
 *     verification as "otp", but on success it also creates the recruiter's
 *     Organization and provisions them as its first RECRUITER, then signs
 *     them straight in. See the provider comment below for why account
 *     creation is deferred until after the code is verified.
 *
 * The login page decides which form to show by calling
 * /api/auth/check-user first: if the account has a password set, it shows
 * the password field (with a "use email code instead" fallback); if not,
 * it falls straight through to the OTP flow exactly as before.
 *
 * The user's role is always resolved from the local User record after
 * either method succeeds — never trusted from anything the client supplies.
 * This same flow is shared by every role (Recruiter, Hiring Manager, Applicant);
 * only the User.role value on our side determines what the signed-in person can do.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      id: "otp",
      name: "Email code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) return null;
        const email = credentials.email.toLowerCase().trim();

        const isValid = await verifyOtp(email, credentials.code.trim());
        if (!isValid) return null;

        // First sign-in defaults to APPLICANT; recruiters/hiring managers get
        // their role either by signing up at /signup (which creates their
        // organization too) or by being provisioned by an admin / the seed
        // script. This keeps the OTP flow role-agnostic while still gating
        // recruiter-only pages/actions by the stored role.
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0], role: "APPLICANT" },
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    CredentialsProvider({
      id: "password",
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null; // no password set — must use OTP

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    CredentialsProvider({
      id: "signup",
      name: "Create an organization",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
        name: { label: "Full name", type: "text" },
        organizationName: { label: "Organization", type: "text" },
        password: { label: "Password", type: "password" },
      },
      /**
       * Recruiter self-service sign-up. Nothing is written to the database
       * until DropAphi confirms the emailed code, so an unverified email can
       * never end up owning an organization (or squatting on someone else's
       * work address with a password only the squatter knows). That's why the
       * form fields ride along with the code instead of being persisted as a
       * pending record first — the OTP is what proves the email, and the rest
       * is the signer-upper's own data, so there's nothing to verify about it.
       *
       * /api/auth/signup validates the same fields and rejects duplicates
       * before the code is ever sent; the checks here are the authoritative
       * ones, since only this path actually creates anything.
       */
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const code = credentials?.code?.trim();
        const name = credentials?.name?.trim();
        const organizationName = credentials?.organizationName?.trim();
        const password = credentials?.password;

        if (!email || !code || !name || !organizationName || !password) return null;
        if (organizationName.length < 2) return null;
        if (!isPasswordValid(password)) return null;

        const isValid = await verifyOtp(email, code);
        if (!isValid) return null;

        const existing = await prisma.user.findUnique({ where: { email } });

        // Already has somewhere to be: an org member, or the platform
        // superadmin (who creates orgs from /admin instead). The code was
        // still valid, so sign them in as they are rather than creating a
        // second organization they didn't ask for.
        if (existing?.organizationId || existing?.role === "SUPERADMIN") {
          return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };
        }

        const passwordHash = await hashPassword(password);

        const user = await prisma.$transaction(async (tx) => {
          const organization = await tx.organization.create({ data: { name: organizationName } });

          // An existing account with no organization is almost always someone
          // who applied to a job first and is now setting up their own org, so
          // upgrade them in place. Their password is left alone if they already
          // had one — same reasoning as set-password/route.ts: holding a valid
          // email code shouldn't silently replace a known password.
          return existing
            ? tx.user.update({
                where: { id: existing.id },
                data: {
                  name,
                  role: "RECRUITER",
                  organizationId: organization.id,
                  passwordHash: existing.passwordHash ?? passwordHash,
                },
              })
            : tx.user.create({
                data: {
                  email,
                  name,
                  role: "RECRUITER",
                  organizationId: organization.id,
                  passwordHash,
                },
              });
        });

        try {
          await sendOrganizationWelcomeEmail({
            to: email,
            organizationName,
            recruiterName: name,
            dashboardUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/jobs/new`,
          });
        } catch (err) {
          // The org and account exist — a failed welcome email is cosmetic and
          // must not block the sign-in that just succeeded.
          console.error("Organization welcome email failed:", err);
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
