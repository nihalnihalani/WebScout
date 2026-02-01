import { getRedisClient } from "./client";
import type { TaskResult } from "../utils/types";

const TASK_PREFIX = "task:";
const TIMELINE_KEY = "tasks:timeline";

export async function storeTask(task: TaskResult): Promise<void> {
  const client = await getRedisClient();
  const key = `${TASK_PREFIX}${task.id}`;
  await client.hSet(key, {
    data: JSON.stringify(task),
    created_at: task.created_at.toString(),
    status: task.status,
  });
  await client.zAdd(TIMELINE_KEY, {
    score: task.created_at,
    value: task.id,
  });
  console.log(`[Tasks] Stored task ${task.id} (${task.status})`);
}

export async function getTask(taskId: string): Promise<TaskResult | null> {
  const client = await getRedisClient();
  const data = await client.hGet(`${TASK_PREFIX}${taskId}`, "data");
  if (!data) return null;
  try {
    return JSON.parse(data) as TaskResult;
  } catch {
    console.error(`[Tasks] Failed to parse task ${taskId}`);
    return null;
  }
}

export async function listTasks(
  limit: number = 20,
  offset: number = 0
): Promise<{ tasks: TaskResult[]; total: number }> {
  const client = await getRedisClient();
  const total = await client.zCard(TIMELINE_KEY);
  const ids = await client.zRange(TIMELINE_KEY, "+inf", "-inf", {
    BY: "SCORE",
    REV: true,
    LIMIT: { offset, count: limit },
  });
  const tasks: TaskResult[] = [];
  for (const id of ids) {
    const task = await getTask(id);
    if (task) tasks.push(task);
  }
  return { tasks, total };
}

export async function getTaskStats(): Promise<{
  total: number;
  successful: number;
  failed: number;
  cached: number;
  recovered: number;
}> {
  const { tasks } = await listTasks(1000, 0);
  return {
    total: tasks.length,
    successful: tasks.filter((t) => t.status === "success").length,
    failed: tasks.filter((t) => t.status === "failed").length,
    cached: tasks.filter((t) => t.used_cached_pattern).length,
    recovered: tasks.filter(
      (t) => t.recovery_attempted && t.status === "success"
    ).length,
  };
}

export async function updateTaskStatus(
  taskId: string,
  status: "pending" | "running" | "success" | "failed"
): Promise<void> {
  const client = await getRedisClient();
  const key = `${TASK_PREFIX}${taskId}`;
  await client.hSet(key, { status });
  const data = await client.hGet(key, "data");
  if (data) {
    const task = JSON.parse(data) as TaskResult;
    task.status = status;
    await client.hSet(key, { data: JSON.stringify(task) });
  }
}
