"use client";

import { usePatterns } from "@/hooks/use-patterns";
import { PatternGrid } from "@/components/pattern-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain } from "lucide-react";

export default function PatternsPage() {
  const { data, isLoading } = usePatterns();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-400" />
          Failure Recovery Library
        </h2>
        <p className="text-zinc-500 mt-1">
          {data?.total || 0} patterns learned from past successes and
          recoveries
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          Each pattern represents a reusable approach for extracting data from
          a type of page. Patterns with higher success counts are more reliable.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 bg-zinc-900 rounded-lg" />
          ))}
        </div>
      ) : (
        <PatternGrid patterns={data?.patterns || []} />
      )}
    </div>
  );
}
