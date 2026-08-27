export function Hero3D() {
  return (
    <div className="scene relative mx-auto h-[320px] w-full max-w-xs sm:h-[380px] sm:max-w-md md:h-[420px] md:max-w-lg">
      <div className="scene-stage relative h-full w-full">
        {/* Qualification core. IMPORTANT: this div must NEVER carry
            left-1/2, top-1/2, or translate-x/y classes — positioning is
            handled entirely by the flex wrapper below, because the
            core-tilt animation owns the `transform` property and will
            silently wipe out any transform-based centering. */}
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <div className="qualification-core flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-accent to-[#123f3f] sm:h-32 sm:w-32 md:h-36 md:w-36">
            <div className="text-center">
              <div className="font-mono text-xl font-bold text-white sm:text-2xl md:text-3xl">91%</div>
              <div className="text-[9px] uppercase tracking-widest text-white/70 sm:text-[10px]">
                Strong Match
              </div>
            </div>
          </div>
        </div>

        <CvCard className="cv-card cv-card--1 left-[2%] top-[8%]" label="Node.js" tone="success" />
        <CvCard className="cv-card cv-card--2 right-[2%] top-[16%]" label="PostgreSQL" tone="success" />
        <CvCard className="cv-card cv-card--3 left-[4%] bottom-[10%]" label="Kubernetes" tone="warning" />
        <CvCard className="cv-card cv-card--4 right-[4%] bottom-[6%]" label="5+ yrs" tone="success" />

        <Chip className="evidence-chip evidence-chip--a left-[22%] top-[2%]">
          Evidence confirmed
        </Chip>
        <Chip className="evidence-chip evidence-chip--b right-[18%] top-[1%]">
          Recruiter review
        </Chip>
        <Chip className="evidence-chip evidence-chip--c left-[26%] bottom-[1%]">
          Explanation generated
        </Chip>
      </div>
    </div>
  );
}

function CvCard({
  className,
  label,
  tone,
}: {
  className: string;
  label: string;
  tone: "success" | "warning";
}) {
  const toneClass = tone === "success" ? "border-success/40 text-success" : "border-warning/40 text-warning";
  return (
    <div
      className={`absolute z-10 h-16 w-24 rounded-lg border bg-surface/95 p-2 shadow-lg backdrop-blur sm:h-20 sm:w-28 sm:p-2.5 ${className} ${toneClass}`}
    >
      <div className="mb-1.5 h-1.5 w-8 rounded-full bg-current opacity-70 sm:w-10" />
      <div className="mb-1 h-1 w-14 rounded-full bg-ink/10 sm:w-16" />
      <div className="mb-2 h-1 w-10 rounded-full bg-ink/10 sm:w-12" />
      <div className="font-mono text-[10px] font-semibold sm:text-[11px]">{label}</div>
    </div>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={`evidence-card absolute z-20 hidden w-max px-3 py-1.5 text-[11px] font-medium shadow-md sm:block ${className}`}
    >
      {children}
    </div>
  );
}