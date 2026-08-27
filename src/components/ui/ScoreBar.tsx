import clsx from "clsx";

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const colorClass =
    score >= 85 ? "bg-success" : score >= 70 ? "bg-accent" : score >= 55 ? "bg-warning" : "bg-danger";

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>{label}</span>
          <span className="font-mono font-medium text-ink">{score}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-border/60">
        <div
          className={clsx("h-2 rounded-full transition-all", colorClass)}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}
