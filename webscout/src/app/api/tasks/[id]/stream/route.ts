import { NextRequest } from "next/server";
import { getTask } from "@/lib/redis/tasks";

export const dynamic = "force-dynamic";

/** Maximum duration (ms) before the SSE stream closes itself. */
const STREAM_TIMEOUT_MS = 120_000;

/** Interval (ms) between Redis polls inside the stream. */
const POLL_INTERVAL_MS = 500;

/**
 * SSE endpoint that streams task updates to the client.
 *
 * The connection stays open, polling Redis every 500 ms, until:
 *   - The task reaches a terminal status ("success" | "failed"), or
 *   - 120 seconds elapse (safety timeout), or
 *   - The client disconnects.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || id.length < 8) {
    return new Response(
      JSON.stringify({ error: "Invalid task ID format" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify the task exists before opening the stream.
  const initialTask = await getTask(id);
  if (!initialTask) {
    return new Response(
      JSON.stringify({ error: "Task not found", id }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      /** Helper to send an SSE-formatted message. */
      function sendEvent(data: string, event?: string): void {
        try {
          let message = "";
          if (event) {
            message += `event: ${event}\n`;
          }
          message += `data: ${data}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Controller may already be closed; swallow the error.
        }
      }

      /** Track whether we already closed so we don't double-close. */
      let closed = false;

      function closeStream(): void {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }

      // Listen for client disconnect via the request signal.
      request.signal.addEventListener("abort", () => {
        closeStream();
      });

      // Send the initial task state immediately.
      sendEvent(JSON.stringify(initialTask));

      // If the task is already in a terminal state, close right away.
      if (initialTask.status === "success" || initialTask.status === "failed") {
        sendEvent(JSON.stringify({ done: true }), "done");
        closeStream();
        return;
      }

      // Poll Redis at the configured interval.
      const intervalId = setInterval(async () => {
        // Safety timeout: close the stream if it has been open too long.
        if (Date.now() - startTime >= STREAM_TIMEOUT_MS) {
          clearInterval(intervalId);
          sendEvent(JSON.stringify({ error: "Stream timeout" }), "error");
          closeStream();
          return;
        }

        // If the client already disconnected, stop polling.
        if (request.signal.aborted || closed) {
          clearInterval(intervalId);
          closeStream();
          return;
        }

        try {
          const task = await getTask(id);

          if (!task) {
            // Task disappeared from Redis -- close gracefully.
            clearInterval(intervalId);
            sendEvent(JSON.stringify({ error: "Task not found" }), "error");
            closeStream();
            return;
          }

          sendEvent(JSON.stringify(task));

          // Terminal states: send a done event and shut down.
          if (task.status === "success" || task.status === "failed") {
            clearInterval(intervalId);
            sendEvent(JSON.stringify({ done: true }), "done");
            closeStream();
          }
        } catch (err) {
          console.error("[SSE] Error polling task:", err);
          // Don't close on transient errors; just skip this tick.
        }
      }, POLL_INTERVAL_MS);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering if behind a proxy
    },
  });
}
