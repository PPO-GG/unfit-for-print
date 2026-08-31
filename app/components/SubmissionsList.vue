<template>
  <div class="submissions-feed">
    <article v-for="submission in submissions" :key="submission.id" class="submission-widget submission-feed__item">
      <div class="submission-feed__card">
        <WhiteCard v-if="submission.cardType === 'white'" :text="submission.text" :threeDeffect="true" />
        <BlackCard v-else :text="submission.text" :numPick="submission.pick || 1" :threeDeffect="true" />
      </div>
      <div class="submission-feed__details">
        <div class="submission-feed__labels">
          <span class="submission-feed__type" :class="`is-${submission.cardType}`">{{ submission.cardType === 'white' ? 'Answer' : 'Prompt' }}</span>
          <span v-if="(submission.upvotes || 0) >= 10" class="submission-feed__hot">Hot</span>
        </div>
        <div class="submission-feed__author">
          <span class="submission-feed__avatar">{{ initials(submission.submitterName) }}</span>
          <div class="min-w-0"><p class="submission-feed__name">{{ submission.submitterName }}</p><p class="submission-feed__time">Submitted {{ formatDate(submission.timestamp) }}</p></div>
        </div>
        <div class="submission-feed__footer">
          <button v-if="isLoggedIn" class="vote-btn submission-feed__vote-button" :class="{ 'vote-active': hasUserUpvoted(submission) }" :disabled="upvotingId === submission.id" :aria-label="`Vote for ${submission.text}`" @click="upvote(submission.id)">
            <Icon :name="hasUserUpvoted(submission) ? 'solar:like-bold-duotone' : 'solar:like-line-duotone'" /><span>{{ submission.upvotes || 0 }}</span><span class="submission-feed__vote-label">upvotes</span>
          </button>
          <div v-else class="vote-display submission-feed__vote-display"><Icon name="solar:like-line-duotone" /><span>{{ submission.upvotes || 0 }}</span><span class="submission-feed__vote-label">upvotes</span></div>
          <div v-if="isAdmin" class="submission-feed__admin-actions">
            <button class="admin-btn adopt-btn" :disabled="adoptingId === submission.id || deletingId === submission.id" aria-label="Adopt submission" @click="adoptSubmission(submission)"><Icon name="solar:check-circle-bold-duotone" /></button>
            <button class="admin-btn delete-btn" :disabled="deletingId === submission.id || adoptingId === submission.id" aria-label="Delete submission" @click="deleteSubmission(submission.id)"><Icon name="solar:trash-bin-trash-bold-duotone" /></button>
          </div>
        </div>
      </div>
    </article>
  </div>
  <div v-if="submissions.length === 0" class="submissions-empty"><Icon name="solar:test-tube-minimalistic-bold-duotone" /><h3>No experiments found</h3><p>No card submissions match the current filters.</p></div>
  <UModal v-model:open="showDeleteModal" title="Delete experiment"><template #body><p class="modal-text">Are you sure you want to delete “{{ submissionToDelete?.text }}”? This cannot be undone.</p></template><template #footer><div class="modal-actions"><UButton color="neutral" variant="soft" @click="showDeleteModal = false">Cancel</UButton><UButton color="error" variant="soft" @click="confirmDelete">Delete</UButton></div></template></UModal>
  <UModal v-model:open="showAdoptModal" title="Adopt experiment"><template #body><p class="modal-text">Add this {{ submissionToAdopt?.cardType }} card to the Unfit Labs pack?</p></template><template #footer><div class="modal-actions"><UButton color="neutral" variant="soft" @click="showAdoptModal = false">Cancel</UButton><UButton color="success" variant="soft" @click="confirmAdopt">Adopt card</UButton></div></template></UModal>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { useIsAdmin } from "~/composables/useAdminCheck";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useUserStore } from "~/stores/userStore";
const props = defineProps<{ submissions: any[] }>();
const emit = defineEmits(["upvote", "delete", "adopt"]);
const userStore = useUserStore(); const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user)); const isAdmin = useIsAdmin();
const upvotingId = ref<string | null>(null); const deletingId = ref<string | null>(null); const adoptingId = ref<string | null>(null); const showDeleteModal = ref(false); const showAdoptModal = ref(false); const submissionToDelete = ref<any>(null); const submissionToAdopt = ref<any>(null);
function formatDate(dateString: string) { try { return formatDistanceToNow(new Date(dateString), { addSuffix: true }); } catch { return "recently"; } }
function initials(name: string) { return (name || "?").split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(); }
function hasUserUpvoted(submission: any) { return Boolean(isLoggedIn.value && userStore.user && (submission.upvoterIds || []).includes(userStore.user.id)); }
async function upvote(submissionId: string) { if (!isLoggedIn.value) return; upvotingId.value = submissionId; try { emit("upvote", submissionId); } finally { setTimeout(() => { upvotingId.value = null; }, 500); } }
function deleteSubmission(submissionId: string) { const submission = props.submissions.find(item => item.id === submissionId); if (!isAdmin.value || !submission) return; submissionToDelete.value = submission; showDeleteModal.value = true; }
async function confirmDelete() { if (!submissionToDelete.value) return; deletingId.value = submissionToDelete.value.id; try { emit("delete", submissionToDelete.value.id); showDeleteModal.value = false; } finally { setTimeout(() => { deletingId.value = null; }, 500); } }
function adoptSubmission(submission: any) { if (!isAdmin.value) return; submissionToAdopt.value = submission; showAdoptModal.value = true; }
async function confirmAdopt() { if (!submissionToAdopt.value) return; adoptingId.value = submissionToAdopt.value.id; try { emit("adopt", submissionToAdopt.value); showAdoptModal.value = false; } finally { setTimeout(() => { adoptingId.value = null; }, 500); } }
</script>

<style scoped>
.submissions-feed{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:1.1rem}.submission-feed__item{display:flex;gap:1rem;padding:1rem;background:rgba(10,13,28,.78);border:1px solid rgba(255,255,255,.1);border-radius:14px;transition:border-color .18s ease,transform .18s ease}.submission-feed__item:hover{border-color:rgba(140,220,120,.42);transform:translateY(-2px)}.submission-feed__card{width:116px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:9px;flex-shrink:0}.submission-feed__card :deep(.white-card),.submission-feed__card :deep(.black-card){transform:scale(.52);transform-origin:center;margin:-57px}.submission-feed__details{min-width:0;flex:1;display:flex;flex-direction:column;gap:.85rem}.submission-feed__labels{display:flex;gap:.4rem;flex-wrap:wrap}.submission-feed__type,.submission-feed__hot{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;padding:.25rem .45rem;border:1px solid;border-radius:4px}.submission-feed__type.is-white{color:#8ee6ff;background:rgba(120,220,255,.1);border-color:rgba(120,220,255,.45)}.submission-feed__type.is-black{color:#c5a8ff;background:rgba(180,140,255,.1);border-color:rgba(180,140,255,.45)}.submission-feed__hot{color:#ffb260;background:rgba(255,160,80,.1);border-color:rgba(255,160,80,.45)}.submission-feed__author{display:flex;align-items:center;gap:.55rem}.submission-feed__avatar{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;background:#8ee6ff;color:#07101b;font-family:'Archivo Black',sans-serif;font-size:.55rem}.submission-feed__name{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f6f3ea;font-family:'Archivo Black',sans-serif;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase}.submission-feed__time{margin:.15rem 0 0;color:#8891b4;font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.07em}.submission-feed__footer{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:auto;padding-top:.7rem;border-top:1px solid rgba(255,255,255,.08)}.vote-btn,.vote-display{display:inline-flex;align-items:center;gap:.35rem;padding:.38rem .55rem;border:1px solid rgba(255,255,255,.13);border-radius:7px;background:rgba(255,255,255,.03);color:#b8c0db;font-family:'JetBrains Mono',monospace;font-size:.67rem}.vote-btn{cursor:pointer}.vote-btn:hover,.vote-btn.vote-active{color:#a9ed87;border-color:rgba(140,220,120,.65);background:rgba(140,220,120,.12)}.vote-btn:disabled{opacity:.5;cursor:wait}.submission-feed__vote-label{color:#69718d;font-size:.55rem;letter-spacing:.08em;text-transform:uppercase}.submission-feed__admin-actions,.modal-actions{display:flex;gap:.4rem}.admin-btn{display:grid;place-items:center;width:28px;height:28px;cursor:pointer;border:1px solid;border-radius:6px;background:transparent}.adopt-btn{color:#a9ed87;border-color:rgba(140,220,120,.35)}.delete-btn{color:#ff8d95;border-color:rgba(255,90,90,.35)}.submissions-empty{padding:4rem 1rem;text-align:center;border:1px dashed rgba(255,255,255,.15);border-radius:14px;color:#8891b4}.submissions-empty h3{color:#f6f3ea;font-family:'Archivo Black',sans-serif;text-transform:uppercase}.submissions-empty :deep(svg){font-size:2.5rem;color:#a9ed87}.modal-text{color:#c6cbe0;line-height:1.5}@media(max-width:640px){.submissions-feed{grid-template-columns:1fr}.submission-feed__card{width:106px}}
</style>
