/** Categories the guard can classify a message as */
export type GuardCategory = "CLEAN" | "INJECTION" | "OFF_TOPIC" | "PII";

/** Result from a single guard layer */
export interface GuardLayerResult {
  blocked: boolean;
  category?: GuardCategory;
  reason?: string;
  latencyMs: number;
  layer: "lakera" | "claude-judge";
}

/** Combined result from the guard pipeline */
export interface GuardResult {
  allowed: boolean;
  category: GuardCategory;
  message?: string; // User-facing rejection message (intentionally vague)
  layers: GuardLayerResult[];
  totalLatencyMs: number;
}

/** Options for dependency injection (testability) */
export interface GuardOptions {
  /** Custom fetch function for Lakera API (defaults to global fetch) */
  fetchFn?: typeof fetch;
  /** Lakera API key (defaults to process.env.LAKERA_GUARD_API_KEY) */
  lakeraApiKey?: string;
  /** Skip Lakera layer entirely */
  skipLakera?: boolean;
  /** Skip Claude Judge layer entirely */
  skipJudge?: boolean;
  /** Custom generateText function for Claude Judge */
  generateTextFn?: (
    options: Record<string, unknown>,
  ) => Promise<{ text: string }>;
}

/** Rejection messages — intentionally vague to not reveal detection mechanism */
export const REJECTION_MESSAGES: Record<
  Exclude<GuardCategory, "CLEAN">,
  string
> = {
  INJECTION:
    "I can only assist with network security analysis questions about your NetFlow data.",
  OFF_TOPIC:
    "I'm specialized in NetFlow security analysis. Please ask questions related to your network data.",
  PII: "I cannot process requests that may involve personally identifiable information outside the dataset.",
};
