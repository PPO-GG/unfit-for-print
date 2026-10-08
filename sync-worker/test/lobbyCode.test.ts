import { describe, expect, it } from "vitest";
import { codeFromDocId, docIdFor, isLobbyCode } from "../src/lobbyCode";

describe("lobbyCode", () => {
  it("accepts 1–16 alphanumerics only", () => {
    expect(isLobbyCode("AB12")).toBe(true);
    expect(isLobbyCode("a".repeat(16))).toBe(true);
    expect(isLobbyCode("")).toBe(false);
    expect(isLobbyCode("a".repeat(17))).toBe(false);
    expect(isLobbyCode("AB-12")).toBe(false);
    expect(isLobbyCode("../x")).toBe(false);
  });

  it("maps codes to Teleportal's doc ids and back", () => {
    expect(docIdFor("AB12")).toBe("lobby/lobby-AB12");
    expect(codeFromDocId("lobby/lobby-AB12")).toBe("AB12");
    expect(codeFromDocId("lobby-AB12")).toBeNull();
    expect(codeFromDocId("lobby/lobby-AB-12")).toBeNull();
  });
});
