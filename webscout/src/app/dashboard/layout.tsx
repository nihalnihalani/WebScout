"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Brain,
  Activity,
  ExternalLink,
  Award,
  MonitorPlay,
  GraduationCap,
  Cpu,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WEAVE_URL =
  process.env.NEXT_PUBLIC_WEAVE_URL ||
  "https://wandb.ai/webscout/webscout/weave";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/live", label: "Live View", icon: MonitorPlay },
  { href: "/patterns", label: "Recovery Library", icon: Brain },
  { href: "/teach", label: "Teach", icon: GraduationCap },
  { href: "/evaluation", label: "Evaluation", icon: Award },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Glassmorphic Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-zinc-950/60 backdrop-blur-2xl p-6 flex flex-col fixed inset-y-0 z-50 shadow-2xl">
        <div className="mb-10 pl-2">
          <h1 className="text-xl font-bold text-white flex items-center gap-3 tracking-tight">
            <div className="relative">
              <Activity className="w-6 h-6 text-emerald-500" />
              <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-full animate-pulse-slow" />
            </div>
            <span className="bg-linear-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              WebScout
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="relative">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
              <div className="absolute inset-0 bg-emerald-500/50 rounded-full animate-ping opacity-75" />
            </div>
            <p className="text-[10px] font-mono text-emerald-500/80 uppercase tracking-widest">
              System Online
            </p>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden",
                  isActive
                    ? "text-white bg-white/5 shadow-[0_0_20px_rgba(16,185,129,0.05)] border border-white/10"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/5 border border-transparent"
                )}
              >
                {isActive && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                    <div className="absolute inset-0 bg-linear-to-r from-emerald-500/10 to-transparent opacity-50" />
                  </>
                )}
                <item.icon
                  className={cn(
                    "w-4 h-4 transition-colors duration-300",
                    isActive
                      ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* System Status / Tech Stack */}
        <div className="mt-auto space-y-6 pt-6 border-t border-white/5">
          <div className="space-y-3">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">
              Core Systems
            </p>
            
            <div className="flex items-center justify-between text-xs text-zinc-400 group cursor-default">
              <span className="flex items-center gap-2">
                <GlobeIcon className="w-3 h-3 text-blue-500" />
                Browserbase
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 group-hover:bg-emerald-400 transition-colors" />
            </div>
            
            <div className="flex items-center justify-between text-xs text-zinc-400 group cursor-default">
              <span className="flex items-center gap-2">
                <BrainIcon className="w-3 h-3 text-purple-500" />
                Stagehand AI
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 group-hover:bg-emerald-400 transition-colors" />
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 group cursor-default">
              <span className="flex items-center gap-2">
                <DatabaseIcon className="w-3 h-3 text-red-500" />
                Redis Vector
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 group-hover:bg-emerald-400 transition-colors" />
            </div>
          </div>

          <a
            href={WEAVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-medium text-yellow-400/90 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/10 transition-all hover:shadow-[0_0_10px_rgba(234,179,8,0.1)] group"
          >
            <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            View Weave Traces
          </a>
        </div>
      </aside>

      <main className="flex-1 ml-72 p-8 overflow-x-hidden min-w-0">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
          {children}
        </div>
      </main>
    </div>
  );
}

// Icons for the status section
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}
