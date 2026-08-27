import Link from "next/link";

export function ViewToggle({
  current,
  basePath,
}: {
  current: "list" | "cards";
  basePath: string;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-border p-0.5">
      <Link
        href={`${basePath}?view=list`}
        className={`rounded px-3 py-1 text-sm transition-colors ${
          current === "list" ? "bg-accent text-white" : "text-muted hover:text-ink"
        }`}
      >
        List
      </Link>
      <Link
        href={`${basePath}?view=cards`}
        className={`rounded px-3 py-1 text-sm transition-colors ${
          current === "cards" ? "bg-accent text-white" : "text-muted hover:text-ink"
        }`}
      >
        Cards
      </Link>
    </div>
  );
}
