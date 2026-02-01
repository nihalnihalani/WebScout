import * as weave from "weave";

let initialized = false;
let weaveClient: ReturnType<typeof weave.init> extends Promise<infer T> ? T : never;

export async function initWeave(): Promise<void> {
  if (initialized) return;
  try {
    weaveClient = await weave.init(process.env.WEAVE_PROJECT || "webscout");
    initialized = true;
    console.log("[Weave] Initialized successfully");
  } catch (error) {
    console.warn("[Weave] Failed to initialize:", (error as Error).message);
    console.warn("[Weave] Tracing will be disabled for this session.");
  }
}

export function getWeaveClient() {
  return weaveClient;
}

/**
 * Create a traced operation with rich metadata and custom summaries.
 * Every traced op becomes a node in the Weave trace tree.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTracedOp<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  options?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summarize?: (result: any) => Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callDisplayName?: (...args: any[]) => string;
  }
): T {
  try {
    return weave.op(fn, {
      name,
      ...(options?.summarize ? { summarize: options.summarize } : {}),
      ...(options?.callDisplayName ? { callDisplayName: options.callDisplayName } : {}),
    }) as T;
  } catch {
    return fn;
  }
}

/**
 * Wrap an async operation with Weave attributes for rich filtering.
 * All child calls inherit these attributes.
 */
export async function withWeaveAttributes<T>(
  attributes: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withAttr = (weave as any).withAttributes;
    if (typeof withAttr === "function") {
      return await withAttr(attributes, fn);
    }
  } catch {
    // withAttributes not available, run without
  }
  return fn();
}

/**
 * Save learned patterns as a versioned Weave Dataset.
 * Each save creates a new version — judges can see the dataset growing.
 */
export async function savePatternDataset(
  patterns: Array<{
    url_pattern: string;
    target: string;
    working_selector: string;
    approach: string;
    success_count: number;
  }>
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DatasetClass = (weave as any).Dataset;
    if (DatasetClass) {
      const dataset = new DatasetClass({
        name: "webscout-learned-patterns",
        rows: patterns,
      });
      const ref = await dataset.save();
      console.log("[Weave] Saved patterns dataset:", ref?.uri?.() || "saved");
      return ref?.uri?.() || "saved";
    }
  } catch (error) {
    console.warn("[Weave] Dataset save failed:", (error as Error).message);
  }
  return null;
}

export { weave };
