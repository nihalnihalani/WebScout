"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    LayoutDashboard,
    ListTodo,
    Brain,
    Activity,
    ExternalLink,
    Award,
    MonitorPlay,
    GraduationCap,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "Tasks", icon: ListTodo },
    { href: "/live", label: "Live View", icon: MonitorPlay },
    { href: "/patterns", label: "Recovery Library", icon: Brain },
    { href: "/teach", label: "Teach", icon: GraduationCap },
    { href: "/evaluation-report", label: "Evaluation", icon: Award },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "border-r border-zinc-800 bg-zinc-900/50 flex flex-col transition-all duration-300 ease-in-out",
                collapsed ? "w-16 p-3" : "w-64 p-6"
            )}
        >
            {/* Header */}
            <div className={cn("mb-8", collapsed && "flex justify-center")}>
                {collapsed ? (
                    <Activity className="w-6 h-6 text-emerald-500" />
                ) : (
                    <>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Activity className="w-6 h-6 text-emerald-500" />
                            WebScout
                        </h1>
                        <p className="text-xs text-zinc-500 mt-1">
                            Every failed click makes it smarter
                        </p>
                    </>
                )}
            </div>

            {/* Navigation */}
            <nav className="space-y-1 flex-1">
                {navItems.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                collapsed && "justify-center",
                                isActive
                                    ? "bg-zinc-800 text-white"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                            )}
                        >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            {!collapsed && item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="mt-auto space-y-4 pt-6 border-t border-zinc-800">
                {/* Collapse Toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <>
                            <ChevronLeft className="w-4 h-4" />
                            <span>Collapse</span>
                        </>
                    )}
                </button>

                {/* External Link */}
                <a
                    href="https://wandb.ai/alhinai/webscout/weave"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={collapsed ? "View in Weave" : undefined}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors",
                        collapsed && "justify-center"
                    )}
                >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && "View in Weave"}
                </a>

                {/* Powered By */}
                {!collapsed && (
                    <div className="space-y-1 text-xs text-zinc-600">
                        <p>Powered by</p>
                        <p className="text-zinc-500">Browserbase + Stagehand</p>
                        <p className="text-zinc-500">Weave (W&B)</p>
                        <p className="text-zinc-500">Redis + RediSearch</p>
                        <p className="text-zinc-500">OpenAI</p>
                        <p className="text-zinc-500">Google Cloud (Gemini)</p>
                        <p className="text-zinc-500">Vercel</p>
                    </div>
                )}
            </div>
        </aside>
    );
}
