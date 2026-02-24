<template>
  <div class="submissions-grid">
    <div
      v-for="submission in submissions"
      :key="submission.$id"
      class="submission-widget"
    >
      <!-- Card Preview -->
      <div class="card-preview-area">
        <div v-if="submission.cardType === 'white'">
          <WhiteCard :text="submission.text" :threeDeffect="true" />
        </div>
        <div v-else>
          <BlackCard
            :text="submission.text"
            :numPick="submission.pick || 1"
            :threeDeffect="true"
          />
        </div>
      </div>

      <!-- Card Meta -->
      <div class="card-meta">
        <div class="meta-divider" />

        <div class="meta-top">
          <div class="submitter-row">
            <span class="submitter-dot" />
            <span class="submitter-name">{{ submission.submitterName }}</span>
          </div>
          <UBadge
            :color="submission.cardType === 'white' ? 'neutral' : 'info'"
            variant="subtle"
            class="type-badge"
          >
            {{ submission.cardType === "white" ? "WHITE" : "BLACK" }}
          </UBadge>
        </div>

        <div class="meta-bottom">
          <span class="meta-timestamp">
            <Icon name="solar:clock-circle-bold-duotone" class="ts-icon" />
            {{ formatDate(submission.timestamp) }}
          </span>

          <div class="meta-actions">
            <!-- Vote button (logged in) -->
            <button
              v-if="isLoggedIn"
              class="vote-btn"
              :class="{ 'vote-active': hasUserUpvoted(submission) }"
              :disabled="upvotingId === submission.$id"
              @click="upvote(submission.$id)"
            >
              <Icon
                :name="
                  hasUserUpvoted(submission)
                    ? 'solar:like-bold-duotone'
                    : 'solar:like-line-duotone'
                "
                class="vote-icon"
              />
              <span class="vote-count">{{ submission.upvotes || 0 }}</span>
            </button>

            <!-- Vote display (guest) -->
            <div v-else class="vote-display">
              <Icon name="solar:like-line-duotone" class="vote-icon" />
              <span class="vote-count">{{ submission.upvotes || 0 }}</span>
            </div>

            <!-- Admin: Adopt -->
            <button
              v-if="isAdmin"
              class="admin-btn adopt-btn"
              :disabled="
                adoptingId === submission.$id || deletingId === submission.$id
              "
              @click="adoptSubmission(submission)"
            >
              <Icon name="solar:check-circle-bold-duotone" class="admin-icon" />
            </button>

            <!-- Admin: Delete -->
            <button
              v-if="isAdmin"
              class="admin-btn delete-btn"
              :disabled="
                deletingId === submission.$id || adoptingId === submission.$id
              "
              @click="deleteSubmission(submission.$id)"
            >
              <Icon
                name="solar:trash-bin-trash-bold-duotone"
                class="admin-icon"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-if="submissions.length === 0" class="submissions-empty">
    <Icon name="solar:test-tube-minimalistic-bold-duotone" class="empty-icon" />
    <h3 class="empty-title">No Experiments Found</h3>
    <p class="empty-desc">No card submissions match your current filters.</p>
  </div>

  <!-- Delete Confirmation Modal -->
  <UModal v-model:open="showDeleteModal" title="Delete Experiment">
    <template #body>
      <div class="modal-body">
        <p class="modal-text">
          Are you sure you want to delete the submission "<strong>{{
            submissionToDelete?.text
          }}</strong
          >"? This action cannot be undone.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          class="modal-btn"
          @click="showDeleteModal = false"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          variant="soft"
          class="modal-btn"
          @click="confirmDelete"
        >
          Delete
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Adopt Confirmation Modal -->
  <UModal v-model:open="showAdoptModal" title="Adopt Experiment">
    <template #body>
      <div class="modal-body">
        <p class="modal-text">
          Adopt this {{ submissionToAdopt?.cardType }} card to the
          <strong>Unfit Labs</strong> pack?
        </p>
        <div class="modal-preview">
          <p class="modal-preview-text">{{ submissionToAdopt?.text }}</p>
          <p class="modal-preview-meta">
            Submitted by: {{ submissionToAdopt?.submitterName }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          class="modal-btn"
          @click="showAdoptModal = false"
        >
          Cancel
        </UButton>
        <UButton
          color="success"
          variant="soft"
          class="modal-btn"
          @click="confirmAdopt"
        >
          Adopt Card
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/userStore";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { formatDistanceToNow } from "date-fns";
import { useIsAdmin } from "~/composables/useAdminCheck";

const props = defineProps<{
  submissions: any[];
}>();

const emit = defineEmits(["upvote", "delete", "adopt"]);

const userStore = useUserStore();
const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));
const isAdmin = useIsAdmin();

const upvotingId = ref<string | null>(null);
const deletingId = ref<string | null>(null);
const adoptingId = ref<string | null>(null);
const showDeleteModal = ref(false);
const submissionToDelete = ref<any>(null);
const showAdoptModal = ref(false);
const submissionToAdopt = ref<any>(null);

function formatDate(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (error) {
    return "Unknown date";
  }
}

function hasUserUpvoted(submission: any) {
  if (!isLoggedIn.value || !userStore.user) return false;
  const upvoterIds = submission.upvoterIds || [];
  return upvoterIds.includes(userStore.user.$id);
}

async function upvote(submissionId: string) {
  if (!isLoggedIn.value) return;
  upvotingId.value = submissionId;
  try {
    emit("upvote", submissionId);
  } finally {
    setTimeout(() => {
      upvotingId.value = null;
    }, 500);
  }
}

function deleteSubmission(submissionId: string) {
  if (!isAdmin.value) return;
  const submission = props.submissions.find((s) => s.$id === submissionId);
  if (!submission) return;
  submissionToDelete.value = submission;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!submissionToDelete.value) return;
  const submissionId = submissionToDelete.value.$id;
  deletingId.value = submissionId;
  try {
    emit("delete", submissionId);
    showDeleteModal.value = false;
  } finally {
    setTimeout(() => {
      deletingId.value = null;
    }, 500);
  }
}

function adoptSubmission(submission: any) {
  if (!isAdmin.value) return;
  submissionToAdopt.value = submission;
  showAdoptModal.value = true;
}

async function confirmAdopt() {
  if (!submissionToAdopt.value) return;
  const submission = submissionToAdopt.value;
  adoptingId.value = submission.$id;
  try {
    emit("adopt", submission);
    showAdoptModal.value = false;
  } finally {
    setTimeout(() => {
      adoptingId.value = null;
    }, 500);
  }
}
</script>

<style scoped>
/* ─── Grid ───────────────────────────────────────────── */
.submissions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* ─── Submission Card Widget ─────────────────────────── */
.submission-widget {
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 0.875rem;
  overflow: hidden;
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
  box-shadow:
    0 2px 12px rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

:global(.dark) .submission-widget {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.1),
    rgba(15, 23, 42, 0.92)
  );
  box-shadow:
    0 0 16px rgba(139, 92, 246, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.submission-widget:hover {
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow:
    0 4px 20px rgba(139, 92, 246, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

:global(.dark) .submission-widget:hover {
  box-shadow:
    0 0 28px rgba(139, 92, 246, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* ─── Card Preview ───────────────────────────────────── */
.card-preview-area {
  display: flex;
  justify-content: center;
  padding: 1.25rem 1rem 0.5rem;
}

/* ─── Card Meta ──────────────────────────────────────── */
.card-meta {
  padding: 0 1rem 1rem;
}

.meta-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(139, 92, 246, 0.25),
    transparent
  );
  margin-bottom: 0.75rem;
}

.meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.submitter-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.submitter-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8b5cf6;
  box-shadow: 0 0 6px #8b5cf688;
  flex-shrink: 0;
}

.submitter-name {
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

:global(.dark) .submitter-name {
  color: #cbd5e1;
}

.type-badge {
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  padding: 0.15rem 0.5rem;
  flex-shrink: 0;
}

.meta-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meta-timestamp {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: #6b7280;
}

:global(.dark) .meta-timestamp {
  color: #64748b;
}

.ts-icon {
  font-size: 0.85rem;
  color: #6b7280;
}

:global(.dark) .ts-icon {
  color: #475569;
}

/* ─── Vote Button ────────────────────────────────────── */
.meta-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.vote-btn,
.vote-display {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 99px;
  padding: 0.25rem 0.6rem;
  color: #6b7280;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

:global(.dark) .vote-btn,
:global(.dark) .vote-display {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.2);
  color: #94a3b8;
}

.vote-btn {
  cursor: pointer;
}

.vote-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.45);
  color: #4b5563;
}

:global(.dark) .vote-btn:hover {
  background: rgba(139, 92, 246, 0.18);
  border-color: rgba(139, 92, 246, 0.4);
  color: #e2e8f0;
}

.vote-btn.vote-active {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.5);
  color: #7c3aed;
}

:global(.dark) .vote-btn.vote-active {
  color: #a78bfa;
}

.vote-icon {
  font-size: 0.95rem;
}

.vote-count {
  letter-spacing: 0.05em;
}

/* ─── Admin Buttons ──────────────────────────────────── */
.admin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 0.4rem;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-icon {
  font-size: 1rem;
}

.adopt-btn {
  color: #16a34a;
  border-color: rgba(22, 163, 74, 0.2);
}

:global(.dark) .adopt-btn {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.15);
}

.adopt-btn:hover {
  background: rgba(22, 163, 74, 0.1);
  border-color: rgba(22, 163, 74, 0.4);
}

:global(.dark) .adopt-btn:hover {
  background: rgba(74, 222, 128, 0.12);
  border-color: rgba(74, 222, 128, 0.4);
}

.delete-btn {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.2);
}

:global(.dark) .delete-btn {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.15);
}

.delete-btn:hover {
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.4);
}

:global(.dark) .delete-btn:hover {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.4);
}

.admin-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ─── Empty State ────────────────────────────────────── */
.submissions-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
  text-align: center;
}

.submissions-empty .empty-icon {
  font-size: 3rem;
  color: #7c3aed;
  margin-bottom: 0.75rem;
  filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.3));
}

.submissions-empty .empty-title {
  font-size: 1.2rem;
  letter-spacing: 0.08em;
  color: #1e1b4b;
  margin-bottom: 0.25rem;
}

:global(.dark) .submissions-empty .empty-title {
  color: #e2e8f0;
}

.submissions-empty .empty-desc {
  font-size: 0.85rem;
  color: #6b7280;
}

:global(.dark) .submissions-empty .empty-desc {
  color: #64748b;
}

/* ─── Modal Styles ───────────────────────────────────── */
.modal-body {
  padding: 0.75rem 0;
}

.modal-text {
  color: #374151;
  font-size: 0.95rem;
  line-height: 1.5;
}

:global(.dark) .modal-text {
  color: #cbd5e1;
}

.modal-preview {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 0.5rem;
}

.modal-preview-text {
  font-size: 0.95rem;
  color: #1e1b4b;
}

:global(.dark) .modal-preview-text {
  color: #f1f5f9;
}

.modal-preview-meta {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.4rem;
}

:global(.dark) .modal-preview-meta {
  color: #64748b;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.modal-btn {
  padding: 0.5rem 1.25rem;
  letter-spacing: 0.06em;
}

/* ─── Responsive ─────────────────────────────────────── */
@media (max-width: 640px) {
  .submissions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
