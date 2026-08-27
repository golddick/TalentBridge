export function EvidenceCard({
  requirement,
  evidence,
  source,
}: {
  requirement: string;
  evidence?: string | null;
  source?: string;
}) {
  return (
    <div className="evidence-card">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-accent-hover">
        {requirement}
      </div>
      {evidence ? (
        <p className="evidence-quote">&ldquo;{evidence}&rdquo;</p>
      ) : (
        <p className="text-sm italic text-muted">No supporting evidence found in the CV.</p>
      )}
      {source && <div className="mt-1 text-xs text-muted">Source: {source}</div>}
    </div>
  );
}
