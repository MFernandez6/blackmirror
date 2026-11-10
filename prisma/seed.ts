/**
 * BLACKMIRROR seed — non-destructive.
 * Creates demo adjusters only when the Adjuster table is empty on a local database,
 * with the password from SEED_PASSWORD. Reference examples are seeded everywhere.
 * Does not wipe BLACKBOX claims.
 */

import { PrismaClient, AdjusterRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedReferenceExamples } from "./seed-references";

const prisma = new PrismaClient();
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "";
const HOSTED_DB = /supabase\.(co|com)/.test(process.env.DATABASE_URL ?? "");

async function main() {
  const existing = await prisma.adjuster.count();
  if (existing === 0 && HOSTED_DB) {
    console.log("Adjuster table is empty on a hosted database; create users in BLACKBOX → Admin → Users.");
  } else if (existing === 0 && SEED_PASSWORD.length < 12) {
    console.error("Skipping demo adjusters: set SEED_PASSWORD (12+ characters).");
  } else if (existing === 0) {

  const passwordHash = await hash(SEED_PASSWORD, 10);
  console.log("Creating seed adjusters…");

  await prisma.adjuster.createMany({
    data: [
      {
        name: "Miguel Fernandez",
        email: "miguel.fernandez@blacklineadjusting.com",
        passwordHash,
        licenseNumber: "W100001",
        role: AdjusterRole.ADMIN,
      },
      {
        name: "Diana Reyes",
        email: "diana.reyes@blacklineadjusting.com",
        passwordHash,
        licenseNumber: "W100002",
        role: AdjusterRole.ADMIN,
      },
      {
        name: "Marcus Chen",
        email: "marcus.chen@blacklineadjusting.com",
        passwordHash,
        licenseNumber: "A123456",
        role: AdjusterRole.ADJUSTER,
      },
      {
        name: "Frankie Diaz",
        email: "frankie@blacklineadjusting.com",
        passwordHash,
        licenseNumber: "A654321",
        role: AdjusterRole.ADJUSTER,
      },
      {
        name: "Sofia Alvarez",
        email: "sofia.alvarez@blacklineadjusting.com",
        passwordHash,
        licenseNumber: "C000111",
        role: AdjusterRole.VIEWER,
      },
    ],
  });
    console.log("Demo adjusters created with the password from SEED_PASSWORD.");
  } else {
    console.log(`Adjusters already present (${existing}).`);
  }

  await seedReferenceExamples(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
