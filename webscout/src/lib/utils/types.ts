export interface PagePattern {
  id: string;
  url_pattern: string;
  target: string;
  working_selector: string;
  approach: "extract" | "act" | "agent";
  created_at: number;
  success_count: number;
  score?: number;
}

export interface TaskRequest {
  url: string;
  target: string;
}

export interface TaskResult {
  id: string;
  url: string;
  target: string;
  status: "pending" | "running" | "success" | "failed";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  used_cached_pattern: boolean;
  recovery_attempted: boolean;
  pattern_id?: string;
  trace_id?: string;
  screenshots: string[];
  steps: TaskStep[];
  created_at: number;
  completed_at?: number;
}

export interface TaskStep {
  action: string;
  status: "success" | "failure" | "recovery" | "info";
  detail: string;
  screenshot?: string;
  dom_snapshot?: string;
  timestamp: number;
}

export interface RecoveryResult {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  strategy_used: "agent" | "act" | "extract_refined" | "gemini";
  working_selector: string;
  screenshot?: string;
}

export interface PatternData {
  url_pattern: string;
  target: string;
  working_selector: string;
  approach: "extract" | "act" | "agent";
}

export interface TaskStats {
  total: number;
  successful: number;
  failed: number;
  cached: number;
  recovered: number;
  patterns_learned: number;
  cache_hit_rate: string;
  recovery_rate: string;
}
