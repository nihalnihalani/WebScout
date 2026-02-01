import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  secondaryIcon?: LucideIcon;
  title: string;
  description: string | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  secondaryIcon: SecondaryIcon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div 
      className={cn(
        "relative flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm overflow-hidden group",
        className
      )}
    >
      {/* Holographic background effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[24px_24px] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03),transparent_70%)] animate-pulse-slow" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full animate-pulse-slow" />
          <div className="relative w-20 h-20 rounded-full bg-zinc-950/80 border border-white/5 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl group-hover:border-emerald-500/20 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all duration-500">
            <Icon className="w-8 h-8 text-zinc-600 group-hover:text-emerald-400 transition-colors duration-500" />
          </div>
          {SecondaryIcon && (
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shadow-lg group-hover:border-emerald-500/30 transition-colors">
              <SecondaryIcon className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400/70 transition-colors" />
            </div>
          )}
        </div>
        
        <h3 className="mb-3 text-lg font-semibold text-white tracking-tight">
          {title}
        </h3>
        
        <div className="max-w-sm text-sm text-zinc-400 leading-relaxed mb-8">
          {description}
        </div>
        
        {action}
      </div>
    </div>
  );
}
