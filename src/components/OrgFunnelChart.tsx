"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type JobBreakdown = {
  title: string;
  qualified: number;
  needsReview: number;
  notQualified: number;
};

export function OrgFunnelChart({ data }: { data: JobBreakdown[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        No applications yet — upload some CVs to a job to see the breakdown here.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="title"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #DEDCD3",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="qualified" stackId="a" name="Qualified" fill="#2F7A4F" radius={[0, 0, 0, 0]} />
        <Bar dataKey="needsReview" stackId="a" name="Needs Review" fill="#B07D22" />
        <Bar dataKey="notQualified" stackId="a" name="Not Qualified" fill="#B0433F" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
