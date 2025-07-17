import React from "react";

export interface StatusCardProps {
  workflow_name: string;
  status: "Active" | "Paused" | "Error" | string;
  last_run: string;
  next_run: string;
  metrics: Record<string, string | number>;
}

const statusColors: Record<string, string> = {
  Active: "text-green-400",
  Paused: "text-yellow-400",
  Error: "text-red-400",
};

export default function StatusCard({
  workflow_name,
  status,
  last_run,
  next_run,
  metrics,
}: StatusCardProps) {
  return (
    <div className="backdrop-blur bg-white/10 border border-white/20 shadow rounded-xl p-5 flex flex-col gap-3 min-w-[220px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white text-lg">{workflow_name}</span>
        <span className={`text-xs font-medium ${statusColors[status] || "text-white/70"}`}>{status}</span>
      </div>
      <div className="flex justify-between text-xs text-white/70">
        <span>Last run: {last_run}</span>
        <span>Next: {next_run}</span>
      </div>
      <div className="flex gap-4 mt-2">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="flex flex-col items-center">
            <span className="text-white text-sm font-bold">{value}</span>
            <span className="text-xs text-white/60">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
