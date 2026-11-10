/**
 * Florida public adjuster rules applied by BLACKSUITE.
 *
 * Sources: Fla. Stat. § 626.854 (public adjuster compensation and contract
 * terms) and § 626.8796 (contract form). Statutes change most sessions —
 * every value here must be re-confirmed by Florida insurance counsel before
 * launch and after each legislative session. Engineering does not interpret
 * the statute; this module only encodes the firm's counsel-approved reading.
 */

export const FL_PA_RULES_REVIEWED = "PENDING COUNSEL REVIEW";

export const FEE_CAP_STANDARD = 20;
export const FEE_CAP_EMERGENCY = 10;
export const FEE_CAP_REOPENED = 20;
export const EMERGENCY_WINDOW_DAYS = 365;
export const RESCISSION_DAYS_AFTER_EXECUTION = 10;
export const RESCISSION_DAYS_AFTER_LOSS_EMERGENCY = 30;
/** Firm SOP target for delivering the executed contract to the insurer. */
export const CONTRACT_TO_INSURER_TARGET_DAYS = 7;

export const CITE_FEE = "Fla. Stat. § 626.854(11)";
export const CITE_RESCISSION = "Fla. Stat. § 626.854(7)";

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export type FeeCapInput = {
  /** Loss arises from an event under a Governor-declared state of emergency */
  isEmergencyLoss: boolean;
  emergencyDeclaredDate?: Date | string | null;
  /** Date the claim was first reported to the insurer */
  claimReportedDate?: Date | string | null;
  isReopenedClaim?: boolean;
};

export type FeeCapResult = {
  capPercent: number;
  /** True when the 10% emergency ceiling governs this file */
  emergencyCapApplies: boolean;
  basis: string;
  cite: string;
  warnings: string[];
};

export function computeFeeCap(input: FeeCapInput): FeeCapResult {
  const warnings: string[] = [];
  const declared = toDate(input.emergencyDeclaredDate);
  const reported = toDate(input.claimReportedDate);

  if (input.isEmergencyLoss) {
    if (!declared) {
      warnings.push("Link the Governor's emergency declaration to confirm the 1-year window.");
    }
    if (!reported) {
      warnings.push("Enter the date the claim was reported to the insurer.");
    }
    const windowEnd = declared ? addDays(declared, EMERGENCY_WINDOW_DAYS) : null;
    if (declared && reported && reported > windowEnd!) {
      return {
        capPercent: input.isReopenedClaim ? FEE_CAP_REOPENED : FEE_CAP_STANDARD,
        emergencyCapApplies: false,
        basis: "Emergency loss, but claim reported more than 1 year after the declaration",
        cite: CITE_FEE,
        warnings,
      };
    }
    return {
      capPercent: FEE_CAP_EMERGENCY,
      emergencyCapApplies: true,
      basis:
        declared && reported
          ? "Declared-emergency loss reported within 1 year of the declaration"
          : "Declared-emergency loss (10% applied until the window can be confirmed)",
      cite: CITE_FEE,
      warnings,
    };
  }

  if (input.isReopenedClaim) {
    return {
      capPercent: FEE_CAP_REOPENED,
      emergencyCapApplies: false,
      basis: "Reopened or supplemental claim — fee only on payments obtained after the contract",
      cite: CITE_FEE,
      warnings,
    };
  }

  return {
    capPercent: FEE_CAP_STANDARD,
    emergencyCapApplies: false,
    basis: "Standard claim",
    cite: CITE_FEE,
    warnings,
  };
}

/** Fee is earned only on payments obtained after the contract; prior insurer payments are excluded. */
export function feeBase(totalRecovery: number, priorInsurerPayments?: number | null): number {
  return Math.max(0, totalRecovery - (priorInsurerPayments ?? 0));
}

export function computeFee(opts: {
  totalRecovery: number;
  priorInsurerPayments?: number | null;
  feePercent: number;
  capPercent: number;
}): { base: number; percent: number; fee: number } {
  const percent = Math.min(opts.feePercent, opts.capPercent);
  const base = feeBase(opts.totalRecovery, opts.priorInsurerPayments);
  return { base, percent, fee: Math.round(base * percent) / 100 };
}

export type RescissionResult = {
  deadline: Date;
  basis: string;
  cite: string;
  isOpen: boolean;
  daysRemaining: number;
};

/** Insured may cancel without penalty until this deadline (end of day). */
export function rescissionDeadline(opts: {
  contractExecutedDate: Date | string | null | undefined;
  dateOfLoss?: Date | string | null;
  isEmergencyLoss: boolean;
  now?: Date;
}): RescissionResult | null {
  const executed = toDate(opts.contractExecutedDate);
  if (!executed) return null;
  const afterExecution = addDays(executed, RESCISSION_DAYS_AFTER_EXECUTION);
  let deadline = afterExecution;
  let basis = `${RESCISSION_DAYS_AFTER_EXECUTION} days after the contract was executed`;

  const loss = toDate(opts.dateOfLoss);
  if (opts.isEmergencyLoss && loss) {
    const afterLoss = addDays(loss, RESCISSION_DAYS_AFTER_LOSS_EMERGENCY);
    if (afterLoss > afterExecution) {
      deadline = afterLoss;
      basis = `${RESCISSION_DAYS_AFTER_LOSS_EMERGENCY} days after the date of loss (declared emergency, later than ${RESCISSION_DAYS_AFTER_EXECUTION} days after execution)`;
    }
  }

  const now = opts.now ?? new Date();
  const endOfDeadline = addDays(deadline, 1);
  return {
    deadline,
    basis,
    cite: CITE_RESCISSION,
    isOpen: now < endOfDeadline,
    daysRemaining: Math.max(0, Math.ceil((endOfDeadline.getTime() - now.getTime()) / DAY_MS) - 1),
  };
}

export type ComplianceFlag = { level: "block" | "warn" | "info"; message: string };

/** Work that should not proceed while the insured can still rescind, plus open compliance gaps. */
export function contractComplianceFlags(opts: {
  contractExecutedDate?: Date | string | null;
  contractCancelledDate?: Date | string | null;
  contractSentToInsurerDate?: Date | string | null;
  dateOfLoss?: Date | string | null;
  isEmergencyLoss: boolean;
  now?: Date;
}): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  if (toDate(opts.contractCancelledDate)) {
    flags.push({ level: "block", message: "Contract cancelled by the insured — no fee is owed on this file." });
    return flags;
  }
  const executed = toDate(opts.contractExecutedDate);
  if (!executed) {
    flags.push({ level: "warn", message: "No executed PA contract recorded." });
    return flags;
  }
  const r = rescissionDeadline({ ...opts, contractExecutedDate: executed });
  if (r?.isOpen) {
    flags.push({
      level: "info",
      message: `Rescission window open until ${r.deadline.toISOString().slice(0, 10)} (${r.daysRemaining} day${r.daysRemaining === 1 ? "" : "s"} left).`,
    });
  }
  if (!toDate(opts.contractSentToInsurerDate)) {
    const due = addDays(executed, CONTRACT_TO_INSURER_TARGET_DAYS);
    const now = opts.now ?? new Date();
    flags.push({
      level: now > due ? "warn" : "info",
      message: `Executed contract not yet sent to the insurer (firm target ${due.toISOString().slice(0, 10)}).`,
    });
  }
  return flags;
}
