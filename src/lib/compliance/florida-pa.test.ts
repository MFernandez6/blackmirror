import { describe, expect, it } from "vitest";
import {
  computeFee,
  computeFeeCap,
  contractComplianceFlags,
  rescissionDeadline,
} from "@/lib/compliance/florida-pa";

describe("computeFeeCap", () => {
  it("caps standard claims at 20%", () => {
    expect(computeFeeCap({ isEmergencyLoss: false }).capPercent).toBe(20);
  });

  it("caps emergency claims reported within a year of the declaration at 10%", () => {
    const r = computeFeeCap({
      isEmergencyLoss: true,
      emergencyDeclaredDate: "2026-10-05",
      claimReportedDate: "2027-03-01",
    });
    expect(r.capPercent).toBe(10);
    expect(r.emergencyCapApplies).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it("returns to 20% when the claim is reported more than a year after the declaration", () => {
    const r = computeFeeCap({
      isEmergencyLoss: true,
      emergencyDeclaredDate: "2026-10-05",
      claimReportedDate: "2027-10-07",
    });
    expect(r.capPercent).toBe(20);
    expect(r.emergencyCapApplies).toBe(false);
  });

  it("stays at 10% with warnings when the window cannot be confirmed", () => {
    const r = computeFeeCap({ isEmergencyLoss: true });
    expect(r.capPercent).toBe(10);
    expect(r.warnings.length).toBe(2);
  });

  it("caps reopened claims at 20%", () => {
    expect(computeFeeCap({ isEmergencyLoss: false, isReopenedClaim: true }).capPercent).toBe(20);
  });
});

describe("computeFee", () => {
  it("excludes insurer payments made before the contract and clamps to the cap", () => {
    const r = computeFee({ totalRecovery: 100_000, priorInsurerPayments: 40_000, feePercent: 25, capPercent: 20 });
    expect(r).toEqual({ base: 60_000, percent: 20, fee: 12_000 });
  });

  it("never produces a negative base", () => {
    expect(computeFee({ totalRecovery: 1_000, priorInsurerPayments: 5_000, feePercent: 10, capPercent: 10 }).fee).toBe(0);
  });
});

describe("rescissionDeadline", () => {
  it("is 10 days after execution for standard claims", () => {
    const r = rescissionDeadline({ contractExecutedDate: "2027-02-01", isEmergencyLoss: false, now: new Date("2027-02-05") });
    expect(r?.deadline.toISOString().slice(0, 10)).toBe("2027-02-11");
    expect(r?.isOpen).toBe(true);
  });

  it("uses 30 days after loss for emergency claims when that is later", () => {
    const r = rescissionDeadline({
      contractExecutedDate: "2027-02-01",
      dateOfLoss: "2027-01-25",
      isEmergencyLoss: true,
    });
    expect(r?.deadline.toISOString().slice(0, 10)).toBe("2027-02-24");
  });

  it("keeps 10 days after execution when it is later than 30 days after loss", () => {
    const r = rescissionDeadline({
      contractExecutedDate: "2027-03-20",
      dateOfLoss: "2027-01-01",
      isEmergencyLoss: true,
    });
    expect(r?.deadline.toISOString().slice(0, 10)).toBe("2027-03-30");
  });

  it("closes after the deadline day", () => {
    const r = rescissionDeadline({ contractExecutedDate: "2027-02-01", isEmergencyLoss: false, now: new Date("2027-02-12T12:00:00Z") });
    expect(r?.isOpen).toBe(false);
  });
});

describe("contractComplianceFlags", () => {
  it("blocks fee work on cancelled contracts", () => {
    const flags = contractComplianceFlags({
      contractExecutedDate: "2027-02-01",
      contractCancelledDate: "2027-02-03",
      isEmergencyLoss: false,
    });
    expect(flags[0].level).toBe("block");
  });

  it("warns when the contract is overdue to the insurer", () => {
    const flags = contractComplianceFlags({
      contractExecutedDate: "2027-02-01",
      isEmergencyLoss: false,
      now: new Date("2027-02-20"),
    });
    expect(flags.some((f) => f.level === "warn" && f.message.includes("insurer"))).toBe(true);
  });
});
