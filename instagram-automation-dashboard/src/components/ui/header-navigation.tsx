import React from "react";

const navItems = [
  { name: "Dashboard", href: "#" },
  { name: "Content", href: "#" },
  { name: "Analytics", href: "#" },
  { name: "Settings", href: "#" },
];

export default function HeaderNavigation() {
  return (
    <nav className="backdrop-blur bg-white/10 border-b border-white/20 shadow-md flex items-center justify-between px-6 py-3 sticky top-0 z-50">
      {/* Logo/Brand */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-lg tracking-tight text-white drop-shadow">InstaAutomate</span>
      </div>
      {/* Nav Items */}
      <ul className="flex gap-6">
        {navItems.map((item) => (
          <li key={item.name}>
            <a
              href={item.href}
              className="text-white/90 hover:text-white font-medium transition-colors px-2 py-1 rounded"
            >
              {item.name}
            </a>
          </li>
        ))}
      </ul>
      {/* Profile/Avatar */}
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-400 border-2 border-white/30 flex items-center justify-center shadow">
          <span className="text-white font-bold">K</span>
        </button>
      </div>
    </nav>
  );
}
