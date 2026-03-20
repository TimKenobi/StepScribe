"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Cloud,
  MessageCircle,
  Users,
  Star,
  Calendar,
  Download,
  Settings,
  Wifi,
  WifiOff,
  Church,
  Brain,
} from "lucide-react";
import { useOffline } from "@/hooks/useOffline";

const NAV_ITEMS = [
  { href: "/", label: "Journal", icon: BookOpen },
  { href: "/sponsor", label: "AI Sponsor", icon: MessageCircle },
  { href: "/progress", label: "One Day at a Time", icon: Calendar },
  { href: "/mood", label: "Inner Weather", icon: Cloud },
  { href: "/heroes", label: "Heroes & Wisdom", icon: Star },
  { href: "/faith", label: "Faith & Tradition", icon: Church },
  { href: "/memory", label: "AI Memory", icon: Brain },
  { href: "/groups", label: "Group Journal", icon: Users },
  { href: "/export", label: "Journal Book", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { online, offlineCount, syncing, syncNow } = useOffline();

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col border-r"
      style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>

      {/* App title — draggable region for macOS traffic lights in desktop */}
      <div className="px-6 pt-10 pb-5 border-b drag-region" style={{ borderColor: "var(--border)" }}>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          StepScribe
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          One day at a time
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Connection status */}
      <div className="px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {online ? (
            <>
              <Wifi size={14} style={{ color: "var(--success)" }} />
              <span>Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={14} style={{ color: "var(--warning)" }} />
              <span>Offline</span>
            </>
          )}
        </div>
        {offlineCount > 0 && (
          <button
            onClick={syncNow}
            disabled={syncing || !online}
            className="mt-2 text-xs px-3 py-1.5 rounded w-full text-center transition-colors"
            style={{
              backgroundColor: "var(--accent-muted)",
              color: "var(--text-primary)",
              opacity: syncing || !online ? 0.5 : 1,
            }}
          >
            {syncing ? "Syncing..." : `Sync ${offlineCount} entries`}
          </button>
        )}
      </div>
    </aside>
  );
}
