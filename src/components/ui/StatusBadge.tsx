import clsx from "clsx";

type Status =
  | "STRONG_MATCH"
  | "QUALIFIED"
  | "NEEDS_REVIEW"
  | "NOT_QUALIFIED"
  | "CONFIRMED"
  | "UNCLEAR"
  | "NOT_FOUND"
  | "SHORTLISTED"
  | "REJECTED"
  | string;

const STYLES: Record<string, string> = {
  STRONG_MATCH: "bg-success-soft text-success",
  QUALIFIED: "bg-success-soft text-success",
  CONFIRMED: "bg-success-soft text-success",
  SHORTLISTED: "bg-success-soft text-success",
  NEEDS_REVIEW: "bg-warning-soft text-warning",
  UNCLEAR: "bg-warning-soft text-warning",
  NOT_QUALIFIED: "bg-danger-soft text-danger",
  NOT_FOUND: "bg-danger-soft text-danger",
  REJECTED: "bg-danger-soft text-danger",
};

const LABELS: Record<string, string> = {
  STRONG_MATCH: "Strong Match",
  QUALIFIED: "Qualified",
  NEEDS_REVIEW: "Needs Review",
  NOT_QUALIFIED: "Not Qualified",
  CONFIRMED: "Confirmed",
  UNCLEAR: "Unclear",
  NOT_FOUND: "Not Found",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx("badge", STYLES[status] ?? "bg-canvas text-muted")}>
      {LABELS[status] ?? status}
    </span>
  );
}
