import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, computed } from "vue";

// ReportCard leans on Nuxt's auto-imports, which plain vitest doesn't provide.
vi.stubGlobal("ref", ref);
vi.stubGlobal("computed", computed);

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/stores/userStore", () => ({
  useUserStore: () => ({ isLoggedIn: true }),
}));

import ReportCard from "~/components/ReportCard.vue";

const stubs = {
  UAlert: { template: "<div />" },
  URadioGroup: {
    props: ["modelValue", "items"],
    emits: ["update:modelValue"],
    template: `<div>
      <label v-for="i in items" :key="i.id">
        <input type="radio" :value="i.id" :checked="modelValue === i.id" @change="$emit('update:modelValue', i.id)" />{{ i.label }}
      </label>
    </div>`,
  },
  UTextarea: { template: "<textarea />" },
  UFieldGroup: { template: "<div><slot /></div>" },
  UButton: { template: `<button v-bind="$attrs"><slot /></button>` },
};

const mountFor = (cardType: "white" | "black") =>
  mount(ReportCard, { props: { cardId: "c1", cardType }, global: { stubs } });

beforeEach(() => fetchMock.mockReset().mockResolvedValue({}));

describe("ReportCard", () => {
  it("offers a wrong-pick-count reason on black cards", () => {
    expect(mountFor("black").text()).toContain("Wrong pick count");
  });

  it("does not offer it on white cards, which have no pick", () => {
    expect(mountFor("white").text()).not.toContain("Wrong pick count");
  });

  it("files the pick reason in words the admin viewer recognises", async () => {
    const wrapper = mountFor("black");
    await wrapper.find('input[value="Pick"]').setValue(true);
    await wrapper.findAll("button").find((b) => b.text() === "Submit Report")!.trigger("click");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reports/create",
      expect.objectContaining({
        body: expect.objectContaining({ reason: expect.stringMatching(/pick/i) }),
      }),
    );
  });
});
