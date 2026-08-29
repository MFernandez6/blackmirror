import type { PrismaClient } from "@prisma/client";
import { INDICATOR_LIBRARY } from "../src/lib/inspection/indicators";
import { embedText, vectorLiteral } from "../src/lib/ai/embed";
import { newId } from "../src/lib/inspection/ids";

const SECOND_PASS: Record<string, string> = {
  "water.staining_active":
    "Dark, still-damp ring with a sharp inner tide line; substrate cool/wet. Distinguishes acute wetting from a dried historic halo used in timing arguments.",
  "water.staining_latent":
    "Tan/yellow oxidized halo, dry to touch, no sheen. Consistent with historic wetting rather than an active leak at time of inspection.",
  "roof.creased_shingles":
    "Linear crease across the tab with granule fracture along the fold — wind-damage signature, not a scuff from foot traffic.",
  "exterior.stucco_map_crack":
    "Interconnected hairline map pattern without displacement. Cosmetic map cracking as distinct from diagonal opening-to-opening structural cracks.",
  "exterior.stucco_diagonal_crack":
    "Single oriented diagonal crack through stucco, often corner-to-opening. Structural pattern, not map cracking.",
};

export async function seedReferenceExamples(prisma: PrismaClient) {
  const existing = await prisma.referenceExample.count();
  if (existing > 0) {
    console.log(`Reference examples already present (${existing}).`);
    return;
  }

  console.log("Seeding reference examples + embeddings…");
  for (const def of INDICATOR_LIBRARY) {
    const descriptions = [
      `${def.label}. ${def.prompt}. Field exemplar for ${def.type}.`,
      SECOND_PASS[def.type] ??
        `Alternate presentation of ${def.label}: ${def.prompt} Document for carrier comparison, not a coverage determination.`,
    ];
    for (let idx = 0; idx < descriptions.length; idx++) {
      const description = descriptions[idx];
      const id = newId();
      const embedding = vectorLiteral(
        embedText(`${def.category} ${def.type} ${def.label} ${description}`)
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ReferenceExample"
          (id, category, "indicatorType", "imageUrl", description, "sourceNote", embedding, "createdAt")
         VALUES ($1, $2::"InspectionCategory", $3, $4, $5, $6, $7::vector, NOW())`,
        id,
        def.category,
        def.type,
        "",
        description,
        idx === 0
          ? "Starter text exemplar — replace with rights-cleared IBHS / FL DOI / file photos."
          : "Starter contrast exemplar for similarity ranking. Swap in a labeled photo when rights allow.",
        embedding
      );
    }
  }
  console.log("Reference library seeded.");
}
