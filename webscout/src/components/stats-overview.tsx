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
    <div className="space-y-4">
      {/* Generation Badge */}
      {generation !== undefined && generation > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">
              Generation {generation}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <TrendingUp className="w-3 h-3" />
            <span>Self-improved {generation} times</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const value = stats[card.key as keyof typeof stats];
          return (
            <Card
              key={card.key}
              className="bg-zinc-900 border-zinc-800 p-6"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-zinc-500">{card.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
