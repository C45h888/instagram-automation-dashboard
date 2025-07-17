import React from "react";

export interface QuickActionsPanelProps {
  workflow_states: Record<string, boolean>;
  system_health: string;
  emergency_mode: boolean;
  on_toggle_workflow: (workflow: string) => void;
}

const workflowNames = ["Auto-Post", "Content Gen", "Analytics", "DM Bot"];

const healthColors: Record<string, string> = {
  Healthy: "text-green-400",
  Warning: "text-yellow-400",
  Critical: "text-red-400",
};

export default function QuickActionsPanel({
  workflow_states,
  system_health,
  emergency_mode,
  on_toggle_workflow,
}: QuickActionsPanelProps) {
  return (
    <div className="backdrop-blur bg-white/10 border border-white/20 shadow rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white text-lg">Quick Actions</span>
        <span className={`text-xs font-medium ${healthColors[system_health] || "text-white/70"}`}>System: {system_health}</span>
      </div>
      <div className="flex gap-4 flex-wrap">
        {workflowNames.map((name) => (
          <button
            key={name}
            onClick={() => on_toggle_workflow(name)}
            className={`px-4 py-2 rounded-lg font-medium transition-all border border-white/20 shadow-sm backdrop-blur-sm ${
              workflow_states[name]
                ? "bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-400 text-white"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {name} {workflow_states[name] ? "ON" : "OFF"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-white/80 text-sm">Emergency Mode:</span>
        <span
          className={`w-3 h-3 rounded-full inline-block mr-1 ${emergency_mode ? "bg-red-500 animate-pulse" : "bg-green-400"}`}
        ></span>
        <span className="text-white/80 text-xs">{emergency_mode ? "ACTIVE" : "Normal"}</span>
      </div>
    </div>
  );
}
