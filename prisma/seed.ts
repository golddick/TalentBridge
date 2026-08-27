import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  // Demo password for both seeded accounts, so you can test password
  // sign-in immediately without going through the "set a password" flow
  // first. In a real deployment, users set this themselves from /account.
  const demoPasswordHash = await hashPassword("password123");

  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@talentbridge.ai" },
    update: { role: "SUPERADMIN" },
    create: {
      email: "superadmin@talentbridge.ai",
      name: "Platform Admin",
      role: "SUPERADMIN",
      passwordHash: demoPasswordHash,
    },
  });

  const org = await prisma.organization.upsert({
    where: { id: "org_demo" },
    update: {},
    create: { id: "org_demo", name: "TalentBridge Consulting" },
  });

  const recruiter = await prisma.user.upsert({
    where: { email: "recruiter@talentbridge.ai" },
    update: {},
    create: {
      email: "recruiter@talentbridge.ai",
      name: "Demo Recruiter",
      role: "RECRUITER",
      organizationId: org.id,
      passwordHash: demoPasswordHash,
    },
  });

  const job = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: "Senior Backend Engineer",
      description:
        "We are looking for a Senior Backend Engineer to design and maintain our core services. Requires strong experience with Node.js, TypeScript, PostgreSQL and REST APIs. AWS, Docker and Kubernetes are a plus.",
      status: "OPEN",
      location: "Remote",
      employmentType: "Full-time",
      qualificationThreshold: 70,
      requirements: {
        create: [
          { name: "Node.js", type: "MANDATORY", weight: 15, mandatory: true },
          { name: "TypeScript", type: "MANDATORY", weight: 10, mandatory: true },
          { name: "PostgreSQL", type: "MANDATORY", weight: 10, mandatory: true },
          { name: "5+ years experience", type: "MANDATORY", weight: 20, mandatory: true },
          { name: "AWS", type: "PREFERRED", weight: 10, mandatory: false },
          { name: "Docker", type: "PREFERRED", weight: 10, mandatory: false },
          { name: "Kubernetes", type: "PREFERRED", weight: 10, mandatory: false },
          { name: "BSc Computer Science", type: "PREFERRED", weight: 15, mandatory: false },
        ],
      },
    },
  });

  console.log("Seeded:", {
    superadmin: superadmin.email,
    recruiter: recruiter.email,
    demoPassword: "password123",
    org: org.name,
    job: job.title,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
