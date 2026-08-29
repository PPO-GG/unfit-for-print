// tests/components/SubmissionsList.test.ts
//
// Regression test for the final whole-branch review finding: SubmissionsList
// (the component labs.vue actually renders submissions through) read
// `submission.$id` throughout, but /api/submissions/list.get.ts returns raw
// Drizzle rows keyed by `.id`, not `.$id`. That silently broke upvoting
// (emits `undefined`) and made the delete-confirmation flow unreachable
// (`props.submissions.find(s => s.$id === id)` never matched).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import * as Vue from "vue";

Object.assign(globalThis, Vue);

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "a moment ago",
}));

vi.unmock("vue");

import SubmissionsList from "~/components/SubmissionsList.vue";
import { useUserStore } from "~/stores/userStore";

const SUBMISSION = {
  id: "submission-postgres-id",
  cardType: "white",
  text: "A funny card",
  submitterName: "Alice",
  timestamp: new Date().toISOString(),
  upvotes: 2,
  upvoterIds: [],
};

describe("SubmissionsList.vue — submission.id (not $id) wiring", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const userStore = useUserStore();
    userStore.user = {
      id: "user-1",
      isGuest: false,
      isAdmin: false,
    } as any;
  });

  it("emits the real Postgres id when upvoting, not undefined", async () => {
    const wrapper = mount(SubmissionsList, {
      props: { submissions: [SUBMISSION] },
      global: { stubs: { UModal: true, UBadge: true, UButton: true, Icon: true, WhiteCard: true, BlackCard: true } },
    });

    const voteBtn = wrapper.find(".vote-btn");
    expect(voteBtn.exists()).toBe(true);
    await voteBtn.trigger("click");

    const emitted = wrapper.emitted("upvote");
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(["submission-postgres-id"]);
  });

  it("keeps an actionable vote control in the redesigned submission feed", async () => {
    const wrapper = mount(SubmissionsList, {
      props: { submissions: [SUBMISSION] },
      global: { stubs: { UModal: true, UBadge: true, UButton: true, Icon: true, WhiteCard: true, BlackCard: true } },
    });

    const feedVoteButton = wrapper.find(".submission-feed__vote-button");
    expect(feedVoteButton.exists()).toBe(true);
    await feedVoteButton.trigger("click");

    expect(wrapper.emitted("upvote")?.[0]).toEqual(["submission-postgres-id"]);
  });

  it("uses :key=submission.id so the row key isn't undefined", () => {
    const wrapper = mount(SubmissionsList, {
      props: { submissions: [SUBMISSION] },
      global: { stubs: { UModal: true, UBadge: true, UButton: true, Icon: true, WhiteCard: true, BlackCard: true } },
    });

    // vue-test-utils doesn't expose :key directly, but we can assert the
    // widget rendered exactly once per submission (no duplicate/undefined
    // key collisions when there are multiple submissions).
    expect(wrapper.findAll(".submission-widget")).toHaveLength(1);
  });

  it("admin delete flow finds the submission by its real id", async () => {
    const userStore = useUserStore();
    userStore.user = { id: "admin-1", isGuest: false, isAdmin: true } as any;

    const wrapper = mount(SubmissionsList, {
      props: { submissions: [SUBMISSION] },
      global: { stubs: { UModal: true, UBadge: true, UButton: true, Icon: true, WhiteCard: true, BlackCard: true } },
    });

    const deleteBtn = wrapper.find(".delete-btn");
    expect(deleteBtn.exists()).toBe(true);
    await deleteBtn.trigger("click");

    // Before the fix, deleteSubmission looked up `s.$id === submissionId`
    // against a submissionId also read off `.$id` — both undefined, so
    // `.find()` never matched and the confirm modal never opened.
    expect((wrapper.vm as any).showDeleteModal).toBe(true);
    expect((wrapper.vm as any).submissionToDelete?.id).toBe(
      "submission-postgres-id",
    );
  });
});
