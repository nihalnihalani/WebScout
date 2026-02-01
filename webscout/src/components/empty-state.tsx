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
        "relative flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 overflow-hidden",
        className
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-size-[24px_24px] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-xl shadow-zinc-900/50">
            <Icon className="w-8 h-8 text-zinc-600" />
          </div>
          {SecondaryIcon && (
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg">
              <SecondaryIcon className="w-3 h-3 text-zinc-500" />
            </div>
          )}
        </div>
        
        <h3 className="mb-2 text-lg font-medium text-white tracking-tight">
          {title}
        </h3>
        
        <div className="max-w-sm text-sm text-zinc-500 leading-relaxed mb-6">
          {description}
        </div>
        
        {action}
      </div>
    </div>
  );
}
