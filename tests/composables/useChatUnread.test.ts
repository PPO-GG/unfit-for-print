import { describe, it, expect } from "vitest";
import { nextTick, ref } from "vue";
import { useChatUnread } from "~/composables/useChatUnread";

describe("useChatUnread", () => {
  it("counts messages that arrive while chat is closed and clears on open", async () => {
    const count = ref(3);
    const viewing = ref(false);
    const { unread } = useChatUnread(count, viewing);
    expect(unread.value).toBe(0); // history at mount is not "unread"
    count.value = 5;
    await nextTick();
    expect(unread.value).toBe(2);
    viewing.value = true;
    await nextTick();
    expect(unread.value).toBe(0);
    count.value = 6; // arrives while open
    await nextTick();
    viewing.value = false;
    await nextTick();
    expect(unread.value).toBe(0);
  });
});
