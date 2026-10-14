import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const openModal = vi.fn();

vi.mock("~/composables/useFeedbackSender", () => ({
  useFeedbackSender: () => ({ send }),
}));
vi.mock("~/composables/useFeedbackModal", () => ({
  useFeedbackModal: () => ({ open: openModal }),
}));

import { useFeedbackPrompt, __resetFeedbackPrompt } from "~/composables/useFeedbackPrompt";
import { RATED_KEY, DISMISSED_KEY, GAMES_KEY } from "~/utils/feedbackCadence";

const game = { lobbyCode: "AB2C", gameEndTime: 1000, isSpectator: false };

beforeEach(() => {
  localStorage.clear();
  send.mockClear();
  openModal.mockClear();
  __resetFeedbackPrompt();
});

describe("useFeedbackPrompt", () => {
  it("asks a player at game over and counts the game", () => {
    const p = useFeedbackPrompt();
    p.offer(game);
    expect(p.stage.value).toBe("ask");
    expect(localStorage.getItem(GAMES_KEY)).toBe("1");
  });

  // Review focus: spectators did not play.
  it("never asks or counts a spectator", () => {
    const p = useFeedbackPrompt();
    p.offer({ ...game, isSpectator: true });
    expect(p.stage.value).toBe("hidden");
    expect(localStorage.getItem(GAMES_KEY)).toBeNull();
  });

  it("offers at most once per game", () => {
    const p = useFeedbackPrompt();
    p.offer(game);
    p.dismiss();
    localStorage.clear(); // even with the cooldown gone
    p.offer(game);
    expect(p.stage.value).toBe("hidden");
    expect(localStorage.getItem(GAMES_KEY)).toBeNull();
  });

  it("asks again for the next game when nothing set a cooldown", () => {
    const p = useFeedbackPrompt();
    p.offer(game);
    p.done();
    p.offer({ ...game, gameEndTime: 2000 });
    expect(p.stage.value).toBe("ask");
  });

  it("stays quiet but still counts the game during a cooldown", () => {
    localStorage.setItem(RATED_KEY, String(Date.now()));
    const p = useFeedbackPrompt();
    p.offer(game);
    expect(p.stage.value).toBe("hidden");
    expect(localStorage.getItem(GAMES_KEY)).toBe("1");
  });

  it("sends the rating at once, remembers it and thanks the player", () => {
    const p = useFeedbackPrompt();
    p.offer(game);
    p.rate(4);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      rating: 4,
      source: "game_over_prompt",
      lobbyCode: "AB2C",
    });
    expect(send.mock.calls[0][0].clientRef).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem(RATED_KEY)).not.toBeNull();
    expect(p.stage.value).toBe("thanks");
  });

  it("records a dismissal only when closed before rating", () => {
    const p = useFeedbackPrompt();
    p.offer(game);
    p.dismiss();
    expect(localStorage.getItem(DISMISSED_KEY)).not.toBeNull();
    expect(p.stage.value).toBe("hidden");
  });

  it("hands the rating and clientRef to the modal on Tell us more", () => {
    const p = useFeedbackPrompt();
    p.offer(game);
    p.rate(5);
    const clientRef = send.mock.calls[0][0].clientRef;
    p.tellMore();
    expect(openModal).toHaveBeenCalledWith({
      mode: "idea",
      rating: 5,
      clientRef,
      source: "game_over_prompt",
      lobbyCode: "AB2C",
    });
    expect(p.stage.value).toBe("hidden");
  });

  it("ignores a rate() call when not asking", () => {
    const p = useFeedbackPrompt();
    p.rate(3);
    expect(send).not.toHaveBeenCalled();
  });

  it("shares one state across callers", () => {
    useFeedbackPrompt().offer(game);
    expect(useFeedbackPrompt().stage.value).toBe("ask");
  });
});
