import React from "react";

export interface MetricCardProps {
  title: string;
  value: string;
  change_percentage: number;
  trend_direction: "up" | "down" | "flat" | string;
  time_period: string;
  sparkline_data: number[];
}

const trendColors: Record<string, string> = {
  up: "text-green-400",
  down: "text-red-400",
  flat: "text-yellow-400",
};

const trendIcons: Record<string, string> = {
  up: "▲",
  down: "▼",
  flat: "▬",
};

export default function MetricCard({
  title,
  value,
  change_percentage,
  trend_direction,
  time_period,
  sparkline_data,
}: MetricCardProps) {
  return (
    <div className="backdrop-blur bg-white/10 border border-white/20 shadow rounded-xl p-5 flex flex-col gap-2 min-w-[180px]">
      <span className="text-white/80 text-xs font-medium">{title}</span>
      <div className="flex items-end gap-2">
        <span className="text-white text-2xl font-bold">{value}</span>
        <span className={`text-sm font-semibold ${trendColors[trend_direction] || "text-white/70"}`}>{trendIcons[trend_direction] || ""} {change_percentage}%</span>
      </div>
      <span className="text-xs text-white/50">{time_period}</span>
      {/* Sparkline placeholder */}
      <div className="h-6 mt-1 flex items-end gap-0.5">
        {sparkline_data.slice(-16).map((v, i) => (
          <div
            key={i}
            className="w-1 rounded bg-gradient-to-t from-pink-500 via-purple-500 to-yellow-400"
            style={{ height: `${Math.max(2, v)}px` }}
          />
        ))}
      </div>
    </div>
  );
}
