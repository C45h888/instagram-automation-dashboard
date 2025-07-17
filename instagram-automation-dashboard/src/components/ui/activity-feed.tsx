"use client";

import React from "react";

export interface Activity {
  activity_type: string;
  description: string;
  timestamp: string;
  user: string;
  status: string;
  details: string;
}

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="backdrop-blur bg-white/10 border border-white/20 shadow rounded-xl p-5 flex flex-col gap-3 min-w-[260px]">
      <span className="font-semibold text-white text-lg mb-2">Recent Activity</span>
      <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {activities.length === 0 && (
          <li className="text-white/60 text-sm">No recent activity.</li>
        )}
        {activities.map((a, i) => (
          <li key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/10 transition">
            <div className="flex flex-col items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-400 flex items-center justify-center text-white font-bold text-sm">
                {a.user[0]}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{a.user}</span>
                <span className="text-xs text-white/50">{a.timestamp}</span>
              </div>
              <div className="text-white/80 text-xs">{a.description}</div>
              <div className="text-xs text-white/60 mt-0.5">{a.activity_type} &bull; {a.status}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
