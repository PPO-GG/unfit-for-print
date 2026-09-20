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
  /** Who has played and who was skipped this round. Ids, like `judgeId` —
   *  pseudonymous, and already the shape `handSizes` is keyed by. */
  submittedPlayerIds?: string[];
  skippedPlayerIds?: string[];
  /** Watchdog rules detecting at the moment of the report. Detection, not a
   *  firing: no threshold has to have elapsed. */
  activeRuleIds?: string[];
  /** Milliseconds this tab has seen the game sit in `phase`. */
  phaseAgeMs?: number;
  /** Transport state: connected / connecting / disconnected / errored / idle. */
  wsState?: string;
  wsSynced?: boolean;
  reconnectCount?: number;
  /** Updates the transport is holding because it has nowhere to send them. */
  bufferedMessages?: number;
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
