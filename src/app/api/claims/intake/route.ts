import { NextResponse } from "next/server";
import { ClaimStatus, Prisma } from "@prisma/client";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fieldIntakeSchema } from "@/lib/schemas/inspection";
import {
  allocateClaimNumber,
  formatClaimNumber,
} from "@/lib/claims/claim-number";
import { toCachedClaim } from "@/lib/inspection/serialize";
import { newId } from "@/lib/inspection/ids";

export const dynamic = "force-dynamic";

function dateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return new Date(`${iso}T12:00:00`);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export async function GET() {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const year = new Date().getFullYear();
  const row = await prisma.claimNumberSequence.findUnique({
    where: { year },
    select: { lastValue: true },
  });
  return NextResponse.json({
    previewNumber: formatClaimNumber(year, (row?.lastValue ?? 0) + 1),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!canEdit(adjuster.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = fieldIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_INTAKE",
        message: parsed.error.errors[0]?.message ?? "Check the intake fields.",
      },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const today = new Date();
  const zip = d.zipCode.slice(0, 5);
  const phone = d.phone;
  const email = d.email;
  const note =
    d.lossDescription.trim() ||
    "Field intake during initial site visit. Desk FNOL to be completed in office.";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const claimNumber = await allocateClaimNumber(tx);
      const claim = await tx.claim.create({
        data: {
          claimNumber,
          status: ClaimStatus.INTAKE,
          lossType: d.lossType,
          dateOfLoss: dateOnly(d.dateOfLoss),
          propertyAddress: d.propertyAddress,
          zipCode: zip,
          county: d.county,
          lossDescription: note,
          isCatClaim: d.isCatClaim,
          contingencyFeePercent: d.isCatClaim
            ? new Prisma.Decimal(10)
            : new Prisma.Decimal(20),
          assignedAdjusterId: adjuster.id,
          initialContactDate: today,
          lossInspectedDate: today,
          claimants: {
            create: {
              firstName: d.firstName,
              lastName: d.lastName,
              email,
              phone,
              mailingAddress: d.propertyAddress,
              preferredContactMethod: phone ? "PHONE" : "EMAIL",
              isPrimaryContact: true,
            },
          },
          statusHistory: {
            create: {
              previousStatus: null,
              newStatus: ClaimStatus.INTAKE,
              changedById: adjuster.id,
              note: `File opened from field (${claimNumber}). Initial site visit; remaining FNOL in office.`,
            },
          },
          auditEvents: {
            create: {
              actorId: adjuster.id,
              action: "FIELD_INTAKE",
              entityType: "Claim",
              summary: `Field intake opened ${claimNumber} during initial site visit.`,
            },
          },
          properties: {
            create: {
              id: newId(),
              label: "Primary",
              address: d.propertyAddress,
              zipCode: zip,
              county: d.county,
            },
          },
        },
      });
      return claim;
    });

    const cached = await toCachedClaim(created.id);
    return NextResponse.json(cached, { status: 201 });
  } catch (err) {
    console.error("Field intake failed:", err);
    return NextResponse.json(
      { error: "INTAKE_FAILED", message: "Unable to open the file. Retry with signal." },
      { status: 500 }
    );
  }
}
