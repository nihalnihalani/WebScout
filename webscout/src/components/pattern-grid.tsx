"use client";

import { PatternCard } from "./pattern-card";
import type { PagePattern } from "@/lib/utils/types";
import { Brain } from "lucide-react";

interface PatternGridProps {
  patterns: PagePattern[];
}

export function PatternGrid({ patterns }: PatternGridProps) {
  if (patterns.length === 0) {
    return (
      <div className="text-center py-16">
        <Brain className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-500 text-lg">No patterns learned yet.</p>
        <p className="text-zinc-600 text-sm mt-1">
          Run some tasks and WebScout will start learning from successes and
          failures!
        </p>
      </div>
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
