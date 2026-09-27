import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConnectionBanner from "~/components/game/ConnectionBanner.vue";

const connectionState = ref("idle");
let wrapper: ReturnType<typeof mount> | null = null;

function mountBanner() {
  vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
  vi.stubGlobal("useLobbyDoc", () => ({ connectionState }));
  wrapper = mount(ConnectionBanner, {
    global: {
      stubs: { Transition: false, UIcon: true, UButton: true },
    },
  });
  return wrapper;
}

async function advance(ms: number) {
  // refDebounced starts its timer from a pre-flush watcher, so the state
  // change has to be flushed before time moves or the timer isn't set yet.
  await nextTick();
  vi.advanceTimersByTime(ms);
  await nextTick();
}

describe("ConnectionBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectionState.value = "connected";
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stays hidden while the link is up", () => {
    const w = mountBanner();
    expect(w.find('[role="status"]').exists()).toBe(false);
  });

  it("ignores a drop that recovers inside the grace period", async () => {
    const w = mountBanner();
    connectionState.value = "disconnected";
    await advance(1000);
    connectionState.value = "connected";
    await advance(2000);
    expect(w.find('[role="status"]').exists()).toBe(false);
  });

  it("shows once the link has been down past the grace period", async () => {
    const w = mountBanner();
    connectionState.value = "errored";
    await advance(2100);
    expect(w.find('[role="status"]').text()).toContain("game.reconnecting");
  });

  it("hides the moment the link comes back", async () => {
    const w = mountBanner();
    connectionState.value = "errored";
    await advance(2100);
    connectionState.value = "connected";
    await nextTick();
    expect(w.find('[role="status"]').exists()).toBe(false);
  });

  it("stays hidden when there is no lobby connection at all", async () => {
    connectionState.value = "idle";
    const w = mountBanner();
    await advance(3000);
    expect(w.find('[role="status"]').exists()).toBe(false);
  });
});
