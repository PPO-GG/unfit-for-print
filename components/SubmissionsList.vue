<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div v-for="submission in submissions" :key="submission.$id" class="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden">
      <!-- Card Preview -->
      <div class="p-4 flex justify-center">
        <div v-if="submission.cardType === 'white'" class="">
          <whiteCard :text="submission.text" :threeDeffect="true" />
        </div>
        <div v-else >
          <blackCard :text="submission.text" :numPick="submission.pick || 1" :threeDeffect="true" />
        </div>
      </div>

      <!-- Card Info -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">
            Submitted by {{ submission.submitterName }}
          </span>
          <UBadge color="secondary" variant="subtle" :class="submission.cardType === 'white' ? 'bg-white text-black' : 'bg-black text-white'">
            {{ submission.cardType === 'white' ? 'White Card' : 'Black Card' }}
          </UBadge>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ formatDate(submission.timestamp) }}
          </span>

          <div class="flex items-center gap-2">
            <UButton
              v-if="isLoggedIn"
              :color="hasUserUpvoted(submission) ? 'primary' : 'neutral'"
              variant="ghost"
              :icon="hasUserUpvoted(submission) ? 'i-solar-like-bold-duotone' : 'i-solar-like-line-duotone'"
              :loading="upvotingId === submission.$id"
              @click="upvote(submission.$id)"
              size="sm"
            >
              {{ submission.upvotes || 0 }}
            </UButton>

            <div v-else class="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Icon name="i-solar-like-line-duotone" class="mr-1" />
              {{ submission.upvotes || 0 }}
            </div>

            <!-- Delete button for admins -->
            <UButton
              v-if="isAdmin"
              color="error"
              variant="ghost"
              icon="i-solar-trash-bin-trash-bold-duotone"
              size="sm"
              @click="deleteSubmission(submission.$id)"
              :loading="deletingId === submission.$id"
              :disabled="deletingId === submission.$id"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-if="submissions.length === 0" class="text-center py-12">
    <Icon name="i-solar-document-text-line-duotone" class="w-12 h-12 mx-auto text-gray-400" />
    <h3 class="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">No submissions</h3>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      No card submissions match your current filters.
    </p>
  </div>

  <!-- Delete Confirmation Modal -->
  <UModal v-model:open="showDeleteModal" :title="'Delete Submission'">
    <template #body>
      <div class="py-4">
        <p>Are you sure you want to delete the submission "{{ submissionToDelete?.text }}" ({{ submissionToDelete?.$id }})? This action cannot be undone.</p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          color="success"
          variant="soft"
          class="p-3"
          @click="showDeleteModal = false"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          variant="soft"
          class="p-3"
          @click="confirmDelete"
        >
          Delete
        </UButton>
      </div>
    </template>
  </UModal>


</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/userStore';
import { isAuthenticatedUser } from '~/composables/useUserUtils';
import { formatDistanceToNow } from 'date-fns';
import { useIsAdmin } from '~/composables/useAdminCheck';

// Props
const props = defineProps<{
  submissions: any[]
}>();

// Emits
const emit = defineEmits(['upvote', 'delete']);

// User authentication
const userStore = useUserStore();
const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));
const isAdmin = useIsAdmin();

// State
const upvotingId = ref<string | null>(null);
const deletingId = ref<string | null>(null);
const showDeleteModal = ref(false);
const submissionToDelete = ref<any>(null);

// Methods
function formatDate(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (error) {
    return 'Unknown date';
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
    emit('upvote', submissionId);
  } finally {
    // Small delay to prevent rapid clicking
    setTimeout(() => {
      upvotingId.value = null;
    }, 500);
  }
}

function deleteSubmission(submissionId: string) {
	if (!isAdmin.value) return;

	const submission = props.submissions.find(s => s.$id === submissionId);
	if (!submission) return;

	// Set the submission to delete and show the modal
	submissionToDelete.value = submission;
	showDeleteModal.value = true;
}

async function confirmDelete() {
	if (!submissionToDelete.value) return;

	const submissionId = submissionToDelete.value.$id;
	deletingId.value = submissionId;

	try {
		emit('delete', submissionId);
		showDeleteModal.value = false;
	} finally {
		// Small delay to prevent rapid clicking
		setTimeout(() => {
			deletingId.value = null;
		}, 500);
	}
}

</script>
