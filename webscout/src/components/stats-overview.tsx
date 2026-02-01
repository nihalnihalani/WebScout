"use client";

import { Card } from "@/components/ui/card";
import { Brain, Target, Zap, RefreshCw, TrendingUp, Sparkles } from "lucide-react";

interface StatsProps {
  stats: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
    recovered: number;
    patterns_learned: number;
    cache_hit_rate: string;
    recovery_rate: string;
  };
  generation?: number;
}

const statCards = [
  {
    key: "total",
    label: "Total Tasks",
    icon: Target,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    key: "patterns_learned",
    label: "Patterns Learned",
    icon: Brain,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    key: "cache_hit_rate",
    label: "Cache Hit Rate",
    icon: Zap,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    key: "recovery_rate",
    label: "Recovery Rate",
    icon: RefreshCw,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

export function StatsOverview({ stats, generation }: StatsProps) {
  return (
    <div className="space-y-6">
      {/* Generation Badge */}
      {generation !== undefined && generation > 0 && (
        <div className="flex items-center gap-3 animate-fade-in-up">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse-slow" />
            <span className="text-sm font-semibold text-emerald-400">
              Generation {generation}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <TrendingUp className="w-3 h-3" />
            <span>Self-improved {generation} times</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const value = stats[card.key as keyof typeof stats];
          return (
            <Card
              key={card.key}
              className={`relative overflow-hidden border-white/5 bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/60 transition-all duration-300 group`}
              style={{
                animationDelay: `${index * 100}ms`
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300 ring-1 ring-inset ring-white/10`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{card.label}</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-4 h-1 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                   <div
                     className={`h-full ${card.color.replace('text-', 'bg-')} opacity-50 transition-all duration-700 ease-out`}
                     style={{
                       width: (() => {
                         const v = String(value);
                         const num = parseFloat(v);
                         if (card.key === "cache_hit_rate" || card.key === "recovery_rate") return isNaN(num) ? "0%" : `${Math.min(num, 100)}%`;
                         if (card.key === "patterns_learned") return `${Math.min(Number(value) * 10, 100)}%`;
                         if (card.key === "total") return `${Math.min(Number(value) * 5, 100)}%`;
                         return "50%";
                       })(),
                     }}
                   />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
