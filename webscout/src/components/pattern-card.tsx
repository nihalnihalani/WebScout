import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PagePattern } from "@/lib/utils/types";
import { Globe, Target, Code, CheckCircle } from "lucide-react";

interface PatternCardProps {
  pattern: PagePattern;
}

const approachColors: Record<string, string> = {
  extract: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  act: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  agent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const approachLabels: Record<string, string> = {
  extract: "Direct Extract",
  act: "Act + Extract",
  agent: "Agent Recovery",
};

export function PatternCard({ pattern }: PatternCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 p-5 hover:border-zinc-700 transition-colors">
      {/* URL Pattern */}
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="text-sm font-mono text-emerald-400 truncate">
          {pattern.url_pattern}
        </span>
      </div>

      {/* Target */}
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="text-sm text-zinc-300">{pattern.target}</span>
      </div>

      {/* Working Selector */}
      <div className="flex items-start gap-2 mb-4">
        <Code className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
        <span className="text-xs text-zinc-500 font-mono line-clamp-2">
          {pattern.working_selector}
        </span>
      </div>

      {/* Footer: approach badge + success count */}
      <div className="flex items-center justify-between">
        <Badge
          className={
            approachColors[pattern.approach] || approachColors.extract
          }
        >
          {approachLabels[pattern.approach] || pattern.approach}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          Used {pattern.success_count} time
          {pattern.success_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Learned timestamp */}
      <p className="text-xs text-zinc-600 mt-3">
        Learned {new Date(pattern.created_at).toLocaleDateString()}
      </p>
    </Card>
  );
}
