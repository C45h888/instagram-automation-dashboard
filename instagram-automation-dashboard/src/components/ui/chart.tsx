import React from "react";

export function ChartContainer({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function ChartTooltip({ content }: { content: React.ReactNode }) {
  return <div>{content}</div>;
}

export function ChartTooltipContent() {
  return <div>Tooltip</div>;
} 