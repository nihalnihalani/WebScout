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

/**
 * Construct a Weave trace URL for the current project.
 * Returns the base calls view URL that can be opened in a browser.
 */
export function getTraceUrl(entity?: string): string {
  const project = process.env.WEAVE_PROJECT || "webscout";
  const org = entity || "webscout";
  return `https://wandb.ai/${org}/${project}/weave/calls`;
}

/**
 * Log an evaluation result as a traced Weave operation.
 * This creates a visible entry in the Weave calls view so judges
 * can see improvement scores tracked over time.
 */
export const logEvaluation = createTracedOp(
  "webscout.evaluation",
  async (evaluationData: {
    improvement_score: number;
    improvement_grade: string;
    speed_factor: string;
    patterns_learned: number;
    tasks_analyzed: number;
    cohorts: {
      first: Record<string, unknown>;
      middle: Record<string, unknown>;
      last: Record<string, unknown>;
    };
    improvements: Array<Record<string, unknown>>;
    summary: Record<string, unknown>;
  }) => {
    return evaluationData;
  },
  {
    summarize: (result) => ({
      "webscout.eval.improvement_score": result.improvement_score,
      "webscout.eval.improvement_grade": result.improvement_grade,
      "webscout.eval.speed_factor": result.speed_factor,
      "webscout.eval.patterns_learned": result.patterns_learned,
      "webscout.eval.tasks_analyzed": result.tasks_analyzed,
    }),
    callDisplayName: () => `evaluation-${new Date().toISOString().slice(0, 10)}`,
  }
);

/**
 * Create an invocable traced op that returns [result, Call] via .invoke().
 * The Call object contains call.id (Weave call ID) and call.traceId.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInvocableOp<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  options?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summarize?: (result: any) => Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callDisplayName?: (...args: any[]) => string;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): T & { invoke?: (...args: any[]) => Promise<[Awaited<ReturnType<T>>, any]> } {
  try {
    const op = weave.op(fn, {
      name,
      ...(options?.summarize ? { summarize: options.summarize } : {}),
      ...(options?.callDisplayName ? { callDisplayName: options.callDisplayName } : {}),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return op as any;
  } catch {
    return fn as T & { invoke?: never };
  }
}

/**
 * Convert a base64 screenshot into a Weave image for display in the Weave UI.
 */
export function createWeaveImage(base64: string): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weaveImage = (weave as any).weaveImage;
    if (typeof weaveImage === "function") {
      // Strip data URI prefix if present
      const raw = base64.replace(/^data:image\/\w+;base64,/, "");
      return weaveImage({ data: Buffer.from(raw, "base64"), imageType: "png" });
    }
  } catch {
    // weaveImage not available
  }
  return base64;
}

/**
 * Attach a retrospective score to an existing Weave call via the feedback API.
 * This enables the closed feedback loop: execute → score → learn.
 *
 * Uses the trace server's feedback/create endpoint, which is the correct
 * way to add annotations to Weave calls (the client.addScore method is
 * designed for the Evaluation framework's internal scorer-based scoring).
 */
export async function addScoreToCall(
  callId: string,
  scorerName: string,
  value: number | boolean,
  comment?: string
): Promise<void> {
  try {
    if (!weaveClient) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = weaveClient as any;
    const projectId = client.projectId as string | undefined;
    const traceApi = client.traceServerApi;

    if (!projectId || !traceApi) return;

    const numericValue = typeof value === "boolean" ? (value ? 1 : 0) : value;
    const weaveRef = `weave:///${projectId}/call/${callId}`;

    // Use the trace server feedback API to create feedback/annotation
    if (typeof traceApi?.feedback?.feedbackCreateFeedbackCreatePost === "function") {
      await traceApi.feedback.feedbackCreateFeedbackCreatePost({
        project_id: projectId,
        weave_ref: weaveRef,
        feedback_type: `webscout.${scorerName}`,
        payload: {
          value: numericValue,
          ...(comment ? { comment } : {}),
        },
        creator: "webscout-agent",
      });
      console.log(`[Weave] Feedback added: ${scorerName}=${numericValue} on call ${callId.substring(0, 12)}...`);
    }
  } catch (error) {
    console.warn("[Weave] addScoreToCall failed:", (error as Error).message);
  }
}

export { weave };
