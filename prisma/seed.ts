/**
 * BLACKMIRROR seed — non-destructive.
 * Creates adjusters only when the Adjuster table is empty.
 * Does not wipe BLACKBOX claims.
 */

import { PrismaClient, AdjusterRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedReferenceExamples } from "./seed-references";

const prisma = new PrismaClient();
const SEED_PASSWORD = "Password123!";

async function main() {
  const existing = await prisma.adjuster.count();
  if (existing === 0) {

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
    console.log("Adjusters created. Password for all: Password123!");
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
