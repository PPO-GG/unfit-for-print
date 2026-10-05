// server/utils/jev.ts
//
// Thin client for TypeSafe's Jev decision model (POST /v1/systemone). Only the
// Choice primitive is used: a bot asks "which of these", and Jev answers with a
// probability for every option. Server-only — the key never reaches a client.
//
// The key is read from process.env at call time, like the other external
// service keys (ELEVENLABS_API_KEY, OPENAI_API_KEY), rather than through
// runtimeConfig, whose process.env reads are fixed at build time.

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_TIMEOUT_MS = 2000;

export class JevError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "JevError";
  }
}

export const jevConfigured = (): boolean =>
  Boolean(process.env.TYPESAFE_API_KEY);

/** Jev's probability for each criteria key. Throws JevError on any failure. */
export async function jevChoose(
  state: string,
  instructions: string,
  criteria: Record<string, string>,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<Record<string, number>> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new JevError("TYPESAFE_API_KEY is not set");

  let res: Response;
  try {
    res = await fetch(JEV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state,
        model: "jev-latest",
        questions: { pick: { type: "choice", instructions, criteria } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    throw new JevError(
      name === "TimeoutError" || name === "AbortError" ? "timeout" : "network",
    );
  }

  if (!res.ok) throw new JevError(`HTTP ${res.status}`, res.status);

  const body = (await res.json().catch(() => null)) as {
    answers?: { pick?: { probabilities?: unknown } };
  } | null;
  const probs = body?.answers?.pick?.probabilities;
  if (!probs || typeof probs !== "object") {
    throw new JevError("malformed response");
  }
  return probs as Record<string, number>;
}
