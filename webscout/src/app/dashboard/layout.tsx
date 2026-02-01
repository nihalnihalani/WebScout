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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex min-h-screen bg-zinc-950">
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-6 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-500" />
            WebScout
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Every failed click makes it smarter
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 pt-6 border-t border-zinc-800">
          <a
            href="https://wandb.ai/webscout/webscout/weave"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View in Weave
          </a>
          <div className="space-y-1 text-xs text-zinc-600">
            <p>Powered by</p>
            <p className="text-zinc-500">Browserbase + Stagehand</p>
            <p className="text-zinc-500">Weave (W&B)</p>
            <p className="text-zinc-500">Redis + RediSearch</p>
            <p className="text-zinc-500">OpenAI</p>
            <p className="text-zinc-500">Google Cloud (Gemini)</p>
            <p className="text-zinc-500">Vercel</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
