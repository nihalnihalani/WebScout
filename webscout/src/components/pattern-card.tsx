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
    <Card className="group relative overflow-hidden bg-zinc-900/40 border-zinc-800 p-5 hover:border-emerald-500/30 hover:bg-zinc-900/60 transition-all duration-300 backdrop-blur-sm">
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/5 to-transparent -mr-10 -mt-10 rounded-full blur-xl group-hover:from-emerald-500/10 transition-colors" />
      
      {/* URL Pattern */}
      <div className="relative flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-zinc-950 border border-white/5 group-hover:border-emerald-500/20 transition-colors">
          <Globe className="w-4 h-4 text-emerald-500/80 shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Pattern Source</p>
          <p className="text-sm font-mono text-emerald-400 truncate group-hover:text-emerald-300 transition-colors">
            {pattern.url_pattern}
          </p>
        </div>
      </div>

      {/* Target */}
      <div className="relative mb-4 pl-11">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-3 h-3 text-zinc-500" />
          <span className="text-xs text-zinc-400 uppercase tracking-wide">Target Field</span>
        </div>
        <p className="text-sm text-zinc-200 font-medium">{pattern.target}</p>
      </div>

      {/* Working Selector */}
      <div className="relative mb-5 bg-zinc-950/50 rounded border border-white/5 p-3 group-hover:border-white/10 transition-colors">
        <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2">
          <Code className="w-3 h-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 font-mono uppercase">Selector Hash</span>
        </div>
        <code className="text-xs text-zinc-400 font-mono break-all line-clamp-2">
          {pattern.working_selector}
        </code>
      </div>

      {/* Footer: approach badge + success count */}
      <div className="relative flex items-center justify-between pt-2 border-t border-white/5">
        <Badge
          variant="outline"
          className={`text-[10px] px-2 py-0.5 h-auto uppercase tracking-wider border-0 ring-1 ring-inset ${
            approachColors[pattern.approach] || approachColors.extract
          }`}
        >
          {approachLabels[pattern.approach] || pattern.approach}
        </Badge>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500/80" />
          <span className="font-mono">{pattern.success_count}</span>
          <span className="text-[10px] uppercase tracking-wide">Executions</span>
        </div>
      </div>
    </Card>
  );
}
