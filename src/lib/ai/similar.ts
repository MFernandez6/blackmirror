import { prisma } from "@/lib/prisma";
import { embedText, vectorLiteral } from "@/lib/ai/embed";
import type { InspectionCategory } from "@/lib/inspection/indicators";

export type ReferenceMatch = {
  id: string;
  category: InspectionCategory;
  indicatorType: string;
  imageUrl: string;
  description: string;
  sourceNote: string;
  similarity: number;
};

export async function findSimilarReferences(
  text: string,
  limit = 3
): Promise<ReferenceMatch[]> {
  const vec = vectorLiteral(embedText(text));
  const rows = await prisma.$queryRawUnsafe<ReferenceMatch[]>(
    `SELECT id, category::text as category, "indicatorType", "imageUrl", description, "sourceNote",
            similarity
     FROM match_reference_examples($1::vector, $2::int)`,
    vec,
    limit
  );
  return rows.map((r) => ({
    ...r,
    category: r.category,
    similarity: Number(r.similarity),
  }));
}
