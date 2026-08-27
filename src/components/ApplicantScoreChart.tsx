"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type ApplicationPoint = {
  jobTitle: string;
  score: number;
  status: string;
};

function colorForStatus(status: string) {
  if (status === "STRONG_MATCH" || status === "QUALIFIED") return "#2F7A4F";
  if (status === "NEEDS_REVIEW") return "#B07D22";
  return "#B0433F";
}

export function ApplicantScoreChart({ data }: { data: ApplicationPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted">
        Apply to a role to see your qualification score here.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: d.jobTitle.length > 16 ? `${d.jobTitle.slice(0, 16)}…` : d.jobTitle,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6B7280" }} />
        <Tooltip
          contentStyle={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #DEDCD3",
          }}
          formatter={(value: number) => [`${value}%`, "Qualification score"]}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={colorForStatus(d.status)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
