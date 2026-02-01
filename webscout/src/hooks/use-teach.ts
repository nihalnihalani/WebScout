import useSWRMutation from "swr/mutation";
import { mutate } from "swr";

interface TeachInput {
  url: string;
  target: string;
  selector: string;
  approach: "extract" | "act" | "agent";
  notes?: string;
}

interface TeachResponse {
  success: boolean;
  pattern_id: string;
  url_pattern: string;
  message: string;
}

async function teachFetcher(
  url: string,
  { arg }: { arg: TeachInput }
): Promise<TeachResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.details?.join(", ") ||
        errorData.error ||
        `Failed to teach pattern (${res.status})`
    );
  }

  return res.json();
}

export function useTeach() {
  const { trigger, isMutating, error, data } = useSWRMutation(
    "/api/teach",
    teachFetcher
  );

  const teach = async (input: TeachInput): Promise<TeachResponse> => {
    const result = await trigger(input);
    // Revalidate the patterns list so it reflects the newly taught pattern
    await mutate("/api/patterns");
    return result;
  };

  return {
    teach,
    isTeaching: isMutating,
    error: error as Error | null,
    lastResult: data ?? null,
  };
}
