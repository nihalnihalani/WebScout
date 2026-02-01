"use client";

import { PatternCard } from "./pattern-card";
import type { PagePattern } from "@/lib/utils/types";
import { Brain, Sparkles } from "lucide-react";
import { EmptyState } from "./empty-state";

interface PatternGridProps {
  patterns: PagePattern[];
}

export function PatternGrid({ patterns }: PatternGridProps) {
  if (patterns.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        secondaryIcon={Sparkles}
        title="No patterns learned yet"
        description="The neural engine hasn't processed any successful extractions yet. Run tasks to begin building the knowledge base."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {patterns.map((pattern) => (
        <PatternCard key={pattern.id} pattern={pattern} />
      ))}
    </div>
  );
}
