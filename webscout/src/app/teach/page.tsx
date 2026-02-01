"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  Plus,
  Check,
  Sparkles,
  Globe,
  Target,
  Code,
  MessageSquare,
  Lightbulb,
  Zap,
  MousePointerClick,
  Bot,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeach } from "@/hooks/use-teach";
import { usePatterns } from "@/hooks/use-patterns";
import { cn } from "@/lib/utils";

type Approach = "extract" | "act" | "agent";

interface FormState {
  url: string;
  target: string;
  selector: string;
  approach: Approach;
  notes: string;
}

const initialFormState: FormState = {
  url: "",
  target: "",
  selector: "",
  approach: "extract",
  notes: "",
};

const approachOptions: {
  value: Approach;
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    value: "extract",
    label: "Extract",
    description: "Pull structured data from the page using CSS selectors or instructions",
    icon: Zap,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/40",
  },
  {
    value: "act",
    label: "Act",
    description: "Perform a click, type, or other browser action on a specific element",
    icon: MousePointerClick,
    color: "text-fuchsia-400",
    bgColor: "bg-fuchsia-500/10",
    borderColor: "border-fuchsia-500/40",
  },
  {
    value: "agent",
    label: "Agent",
    description: "Use the AI agent to reason about the page and accomplish the goal",
    icon: Bot,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/40",
  },
];

function extractUrlPatternClient(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const pathSegments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        if (/^[a-f0-9-]{8,}$/i.test(segment)) return "*";
        if (/^\d{4,}$/.test(segment)) return "*";
        if (/^B[A-Z0-9]{9}$/.test(segment)) return "*";
        if (/^[a-z0-9_-]+_\d+$/i.test(segment)) return "*";
        return segment;
      });
    return `${hostname}/${pathSegments.join("/")}`;
  } catch {
    return "";
  }
}

export default function TeachPage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const { teach, isTeaching, error, lastResult } = useTeach();
  const { data: patternsData, isLoading: patternsLoading } = usePatterns();

  // Derive URL pattern from form.url directly (no effect needed)
  const urlPattern = useMemo(
    () => (form.url.length > 10 ? extractUrlPatternClient(form.url) : ""),
    [form.url]
  );

  // Clear success state after delay
  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => setSubmitted(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const updateField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!form.url) {
      errors.url = "URL is required";
    } else {
      try {
        new URL(form.url);
      } catch {
        errors.url = "Must be a valid URL (e.g., https://example.com/page)";
      }
    }

    if (!form.target.trim()) {
      errors.target = "Target description is required";
    }

    if (!form.selector.trim()) {
      errors.selector = "Selector or instruction is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) return;

      try {
        await teach({
          url: form.url,
          target: form.target,
          selector: form.selector,
          approach: form.approach,
          notes: form.notes || undefined,
        });

        setSubmitted(true);
        setForm(initialFormState);
        setValidationErrors({});
      } catch {
        // Error is handled by the hook
      }
    },
    [form, validate, teach]
  );

  const recentPatterns = patternsData?.patterns?.slice(0, 5) ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-72 h-72 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-8 right-0 w-48 h-48 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Teaching Mode</h2>
              <p className="text-zinc-500 text-sm">
                Manually teach WebScout how to handle specific pages
              </p>
            </div>
          </div>
          <p className="text-zinc-400 text-sm mt-3 max-w-2xl leading-relaxed">
            When you know the right CSS selector or extraction approach for a
            page, teach it directly. The pattern will be stored with a vector
            embedding so WebScout can find and reuse it automatically on similar
            pages.
          </p>
        </div>
      </div>

      {/* Teaching Form */}
      <Card className="border-zinc-800 bg-zinc-900/70 backdrop-blur-sm shadow-xl shadow-violet-500/5">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-400" />
            Teach a New Pattern
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                Page URL
              </label>
              <Input
                value={form.url}
                onChange={(e) => updateField("url", e.target.value)}
                placeholder="https://example.com/products/widget-123"
                className={cn(
                  "bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20",
                  validationErrors.url &&
                    "border-red-500/50 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                )}
              />
              {validationErrors.url && (
                <p className="text-xs text-red-400">{validationErrors.url}</p>
              )}
              {urlPattern && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-600">Pattern:</span>
                  <code className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                    {urlPattern}
                  </code>
                </div>
              )}
            </div>

            {/* Target Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Target className="w-3.5 h-3.5 text-violet-400" />
                Extraction Target
              </label>
              <Input
                value={form.target}
                onChange={(e) => updateField("target", e.target.value)}
                placeholder="e.g., product title, price, and description"
                className={cn(
                  "bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20",
                  validationErrors.target &&
                    "border-red-500/50 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                )}
              />
              {validationErrors.target && (
                <p className="text-xs text-red-400">
                  {validationErrors.target}
                </p>
              )}
              <p className="text-xs text-zinc-600">
                Describe what data should be extracted or what action should be
                performed
              </p>
            </div>

            {/* Selector Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Code className="w-3.5 h-3.5 text-violet-400" />
                CSS Selector / Instruction
              </label>
              <Textarea
                value={form.selector}
                onChange={(e) => updateField("selector", e.target.value)}
                placeholder={`e.g., .product-card h1.title, .price-display span.amount\nor: "Click the 'Add to Cart' button inside the product card"`}
                rows={3}
                className={cn(
                  "bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-sm focus-visible:border-violet-500 focus-visible:ring-violet-500/20",
                  validationErrors.selector &&
                    "border-red-500/50 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                )}
              />
              {validationErrors.selector && (
                <p className="text-xs text-red-400">
                  {validationErrors.selector}
                </p>
              )}
              <p className="text-xs text-zinc-600">
                Enter a CSS selector for extract mode, or a natural language
                instruction for act/agent mode
              </p>
            </div>

            {/* Approach Selector */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Approach
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {approachOptions.map((option) => {
                  const isSelected = form.approach === option.value;
                  const Icon = option.icon;

                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => updateField("approach", option.value)}
                      className={cn(
                        "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200",
                        isSelected
                          ? `${option.bgColor} ${option.borderColor} shadow-md`
                          : "border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/60"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5">
                          <Check className={cn("w-3.5 h-3.5", option.color)} />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Icon
                          className={cn(
                            "w-4 h-4",
                            isSelected ? option.color : "text-zinc-500"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isSelected ? "text-white" : "text-zinc-400"
                          )}
                        >
                          {option.label}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          isSelected ? "text-zinc-300" : "text-zinc-600"
                        )}
                      >
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                Notes
                <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <Textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Any additional context, e.g., 'Works only when logged out' or 'Page uses shadow DOM'"
                rows={2}
                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 text-sm focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{error.message}</p>
              </div>
            )}

            {/* Success Display */}
            {submitted && lastResult && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-start gap-3">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-emerald-300 font-medium">
                    Pattern taught successfully
                  </p>
                  <p className="text-xs text-emerald-400/70 mt-1">
                    Stored as{" "}
                    <code className="px-1 py-0.5 rounded bg-emerald-500/10 font-mono">
                      {lastResult.pattern_id}
                    </code>{" "}
                    for pattern{" "}
                    <code className="px-1 py-0.5 rounded bg-emerald-500/10 font-mono">
                      {lastResult.url_pattern}
                    </code>
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center gap-4 pt-2">
              <Button
                type="submit"
                disabled={isTeaching}
                className={cn(
                  "relative px-6 h-10 font-semibold text-sm",
                  "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500",
                  "text-white shadow-lg shadow-violet-500/20",
                  "transition-all duration-200",
                  isTeaching && "opacity-80"
                )}
              >
                {isTeaching ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Teaching...
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4" />
                    Teach Pattern
                  </>
                )}
              </Button>
              <p className="text-xs text-zinc-600">
                The pattern will be embedded and stored for future reuse
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recently Taught Patterns */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" />
            Recent Patterns
            {patternsData?.total !== undefined && (
              <Badge className="ml-2 bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
                {patternsData.total} total
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patternsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 bg-zinc-800/50 rounded-lg" />
              ))}
            </div>
          ) : recentPatterns.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No patterns yet</p>
              <p className="text-zinc-600 text-xs mt-1">
                Teach your first pattern above, or run tasks to learn
                automatically
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPatterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3 transition-colors hover:bg-zinc-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-mono text-violet-300 truncate max-w-[280px]">
                        {pattern.url_pattern}
                      </code>
                      <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="text-xs text-zinc-400 truncate max-w-[200px]">
                        {pattern.target}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-zinc-600 font-mono truncate max-w-[400px]">
                        {pattern.working_selector}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      className={cn(
                        "text-xs capitalize border",
                        pattern.approach === "extract" &&
                          "bg-violet-500/10 text-violet-400 border-violet-500/30",
                        pattern.approach === "act" &&
                          "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
                        pattern.approach === "agent" &&
                          "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      )}
                    >
                      {pattern.approach}
                    </Badge>
                    <span className="text-xs text-zinc-600 tabular-nums">
                      {pattern.success_count}x
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="border-zinc-800/60 bg-zinc-900/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-zinc-300 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500/70" />
            How Teaching Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold">
                  1
                </span>
                You teach a pattern
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed pl-7">
                Enter the URL, what to extract, and the CSS selector or
                instruction that works. Pick whether it is an extract, act, or
                agent approach.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold">
                  2
                </span>
                WebScout embeds it
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed pl-7">
                The URL pattern and target are converted into a vector embedding
                and stored in Redis with RediSearch. This enables semantic
                similarity matching.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold">
                  3
                </span>
                Future tasks reuse it
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed pl-7">
                When a new task arrives for a similar page, WebScout finds your
                taught pattern via KNN vector search and applies it
                automatically, skipping the trial-and-error process.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/60">
            <h4 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">
              Tips for effective teaching
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500">
                  Use specific CSS selectors like{" "}
                  <code className="text-violet-400/70">.product-title h1</code>{" "}
                  rather than generic ones like <code className="text-zinc-600">div &gt; span</code>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500">
                  The URL pattern auto-normalizes IDs and numbers to{" "}
                  <code className="text-violet-400/70">*</code> wildcards so
                  patterns match across similar pages
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500">
                  For dynamic pages, prefer the{" "}
                  <strong className="text-zinc-400">agent</strong> approach
                  which can reason about the DOM structure
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500">
                  Taught patterns start with a success count of 1 and grow as
                  they are reused successfully
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
