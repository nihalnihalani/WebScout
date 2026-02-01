import * as weave from "weave";

let initialized = false;

export async function initWeave(): Promise<void> {
  if (initialized) return;
  try {
    await weave.init(process.env.WEAVE_PROJECT || "webscout");
    initialized = true;
    console.log("[Weave] Initialized successfully");
  } catch (error) {
    console.warn("[Weave] Failed to initialize:", (error as Error).message);
    console.warn("[Weave] Tracing will be disabled for this session.");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTracedOp<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  try {
    return weave.op(fn, { name }) as T;
  } catch {
    return fn;
  }
}

export { weave };
