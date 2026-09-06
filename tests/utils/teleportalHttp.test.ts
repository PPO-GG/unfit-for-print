import { describe, it, expect } from "vitest";
import { teleportalHttpBase } from "~/utils/teleportalHttp";

describe("teleportalHttpBase", () => {
  it("maps a secure websocket origin to https", () => {
    expect(teleportalHttpBase("wss://teleportal.unfit.cards")).toBe(
      "https://teleportal.unfit.cards",
    );
  });

  it("maps a plain websocket origin to http", () => {
    expect(teleportalHttpBase("ws://localhost:1235")).toBe(
      "http://localhost:1235",
    );
  });

  it("keeps a non-default port", () => {
    expect(teleportalHttpBase("ws://10.0.0.9:1235")).toBe(
      "http://10.0.0.9:1235",
    );
  });

  // Discord Activity routes through a same-origin proxy path rather than a bare
  // origin, so the path has to survive.
  it("preserves a proxy path and drops a trailing slash", () => {
    expect(teleportalHttpBase("wss://app.discordsays.com/teleportal/")).toBe(
      "https://app.discordsays.com/teleportal",
    );
  });

  it("strips any query string", () => {
    expect(teleportalHttpBase("ws://localhost:1235/?token=abc")).toBe(
      "http://localhost:1235",
    );
  });

  it("returns null for something unparseable rather than throwing", () => {
    // Callers treat null as "no preload available" and fall back to plain
    // websocket sync, so this must never throw into the connect path.
    expect(teleportalHttpBase("not a url")).toBeNull();
    expect(teleportalHttpBase("")).toBeNull();
  });
});
