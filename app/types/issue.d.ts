export type IssueKind =
  | "client-error"
  | "api-error"
  | "player-report"
  | "anomaly"
  | "server-error";

export type IssueStatus = "open" | "resolved" | "muted";

/**
 * Structural game state only. Never card text, never chat — see the
 * Non-goals section of the design doc. The ingest route re-serializes
 * against exactly these keys, so adding a field here is also the way to
 * allow it through the allowlist.
 */
export interface IssueContext {
  phase?: string;
  round?: number;
  judgeId?: string;
  activePlayerCount?: number;
  submissionCount?: number;
  handSizes?: Record<string, number>;
  whiteDeckCount?: number;
  blackDeckCount?: number;
  isHost?: boolean;
  /** anomaly only */
  ruleId?: string;
  /** player-report only */
  category?: string;
  /** api-error only — the HTTP method of the request that errored */
  method?: string;
  /** api-error only — the response status code, e.g. 500 */
  statusCode?: number;
}

export interface IssueReportInput {
  kind: IssueKind;
  message: string;
  stack?: string;
  lobbyCode?: string;
  route?: string;
  platform?: string;
  appVersion?: string;
  context?: IssueContext;
}
