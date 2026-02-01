import { useState, useEffect, useRef, useCallback } from "react";
import type { TaskResult } from "@/lib/utils/types";

interface UseTaskStreamReturn {
  task: TaskResult | null;
  isRunning: boolean;
  error: string | null;
}

/**
 * React hook that subscribes to a task's SSE stream for real-time updates.
 *
 * Connects to `/api/tasks/${taskId}/stream` using the browser's EventSource
 * API. Automatically cleans up the connection on unmount or when the taskId
 * changes. Falls back gracefully (returns null task) if SSE fails.
 *
 * @param taskId - The task ID to stream, or null to stay idle.
 */
export function useTaskStream(taskId: string | null): UseTaskStreamReturn {
  const [task, setTask] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  /** Close the current EventSource if one is active. */
  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Reset state when taskId changes.
    setTask(null);
    setError(null);

    if (!taskId) {
      closeEventSource();
      return;
    }

    // Close any previous connection before opening a new one.
    closeEventSource();

    const url = `/api/tasks/${taskId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    /** Handle normal data messages (unnamed events). */
    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as TaskResult;
        // Only update state if this looks like a valid task object.
        if (data && data.id && data.status) {
          setTask(data);
          setError(null);
        }
      } catch {
        // Ignore malformed messages (e.g. the {done:true} event when
        // sent without an explicit event type -- unlikely but safe).
      }
    };

    /** Handle the custom "done" event -- server signals task is complete. */
    es.addEventListener("done", () => {
      // The last task state was already set via onmessage; just close.
      closeEventSource();
    });

    /** Handle the custom "error" event from the server. */
    es.addEventListener("error", ((event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { error?: string };
        if (data.error) {
          setError(data.error);
        }
      } catch {
        // Not a server-sent error event; fall through to onerror.
      }
    }) as EventListener);

    /** Handle native EventSource errors (connection issues, etc.). */
    es.onerror = () => {
      // EventSource will auto-reconnect on transient errors.
      // If it transitions to CLOSED, we treat it as a graceful end.
      if (es.readyState === EventSource.CLOSED) {
        closeEventSource();
      }
      // We intentionally do NOT set an error here so the last known
      // task state remains available (graceful fallback).
    };

    // Cleanup on unmount or when taskId changes.
    return () => {
      closeEventSource();
    };
  }, [taskId, closeEventSource]);

  const isRunning =
    task?.status === "running" || task?.status === "pending";

  return { task, isRunning, error };
}
