import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ScreenBackButton from "~/components/ScreenBackButton.vue";

// @ts-ignore — provided by @nuxtjs/i18n's auto-import at runtime
globalThis.useI18n = () => ({
  t: (key: string, params?: { name?: string }) =>
    key === "nav.back_to" ? `Back to ${params?.name}` : key,
});

function mountButton() {
  return mount(ScreenBackButton, {
    props: { to: "/legal", label: "Legal" },
    global: {
      components: {
        NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
      },
    },
  });
}

describe("ScreenBackButton", () => {
  it("links to the parent screen and names it", () => {
    const link = mountButton().find("a");

    expect(link.attributes("href")).toBe("/legal");
    expect(link.text().replace(/\s+/g, " ")).toBe("↩ Legal");
  });

  it("reads as a back link to assistive technology", () => {
    expect(mountButton().find("a").attributes("aria-label")).toBe("Back to Legal");
  });
});
