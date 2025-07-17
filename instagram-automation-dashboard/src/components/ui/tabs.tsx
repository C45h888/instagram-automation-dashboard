import React from "react";

export function Tabs({ value, onValueChange, children, className }: any) {
  return <div className={className}>{children}</div>;
}

export function TabsList({ children, className }: any) {
  return <div className={className}>{children}</div>;
}

export function TabsTrigger({ value, children, className }: any) {
  return <button className={className}>{children}</button>;
}

export function TabsContent({ value, children, className }: any) {
  return <div className={className}>{children}</div>;
} 