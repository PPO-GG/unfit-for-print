<template>
	<div class="container mx-auto px-4 py-8">

		<!-- Submission Form -->
		<UCollapsible v-model:open="submitCardOpen" class="bg-slate-100 dark:bg-slate-800 rounded-lg mb-8">
			<UButton
					:ui="{
        trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200'
      }"
					block
					class="group p-4"
					color="neutral"
					label="Submit A Card"
					trailing-icon="i-solar-double-alt-arrow-down-line-duotone"
					variant="subtle"
			/>
			<template #content>
				<ClientOnly>
					<CardSubmissionForm @card-submitted="handleCardSubmitted"/>
				</ClientOnly>
			</template>
		</UCollapsible>

		<!-- Submissions List -->
		<div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
			<h2 class="text-2xl font-semibold mb-4">Community Submissions</h2>

			<!-- Filters and Sorting -->
			<ClientOnly>
				<div class="flex flex-wrap gap-4 mb-6">
					<!-- Card Type Filter -->
					<USelect
							v-model="filters.cardType"
							:items="cardTypeOptions"
							class="w-full sm:w-auto"
							placeholder="Card Type"
					/>

					<!-- Sort By -->
					<USelect
							v-model="filters.sortBy"
							:items="sortOptions"
							class="w-full sm:w-auto"
							placeholder="Sort By"
					/>

					<!-- Sort Direction -->
					<USelect
							v-model="filters.sortDirection"
							:items="sortDirectionOptions"
							class="w-full sm:w-auto"
							placeholder="Sort Direction"
					/>

					<!-- Search -->
					<UInput
							v-model="filters.search"
							class="w-full sm:w-auto flex-grow"
							icon="i-solar-card-search-bold-duotone"
							placeholder="Search submissions..."
					/>
				</div>
			</ClientOnly>

			<!-- Cards Display -->
			<ClientOnly>
				<LoadingOverlay :is-loading="loading"/>
			</ClientOnly>

			<ClientOnly>
				<template v-if="submissions.length === 0">
					<div class="text-center py-8">
						<p class="text-gray-500 dark:text-gray-400">No submissions found. Why not log in and submit one of your own?</p>
					</div>
				</template>
				<template v-else>
					<SubmissionsList
							:submissions="paginatedSubmissions"
							@delete="handleDelete"
							@upvote="handleUpvote"
							@adopt="handleAdopt"
					/>

					<!-- Pagination -->
					<div class="mt-6 flex flex-wrap items-center justify-between gap-4">
						<USelect
								v-model="pagination.perPage"
								:items="perPageOptions"
								class="w-32"
						/>

						<UPagination
								v-model="pagination.page"
								color="secondary"
								variant="subtle"
								:page-count="pageCount"
								:total="filteredSubmissions.length"
						/>
					</div>
				</template>
			</ClientOnly>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {useUserStore} from '~/stores/userStore';
import {isAuthenticatedUser} from '~/composables/useUserUtils';
import {useIsAdmin} from '~/composables/useAdminCheck';
import {useAppwrite} from '~/composables/useAppwrite';
import {Query} from 'appwrite';
import { watchDebounced } from '@vueuse/core'

// User authentication
const submitCardOpen = ref(false)
const userStore = useUserStore();
const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));
const isAdmin = useIsAdmin();

// Appwrite
const {databases, client} = useAppwrite();
const config = useRuntimeConfig();

// State
const submissions = ref<any[]>([]);
const loading = ref(true);
const lastLoadedId = ref<string | null>(null);
const hasMoreSubmissions = ref(true);
const upvoteInProgress = ref(false);

// Filters and sorting
const filters = ref({
	cardType: 'all',
	sortBy: 'timestamp',
	sortDirection: 'desc',
	search: '',
});

watchDebounced(
		() => filters.value.search,
		() => {
			pagination.value.page = 1;
		},
		{ debounce: 500, maxWait: 1000 }
);

const cardTypeOptions = [
	{label: 'All Cards', value: 'all'},
	{label: 'White Cards', value: 'white'},
	{label: 'Black Cards', value: 'black'},
];

const sortOptions = [
	{label: 'Submission Date', value: 'timestamp'},
	{label: 'Most Upvotes', value: 'upvotes'},
	{label: 'Text Length', value: 'textLength'},
	{label: 'Number of Picks', value: 'pick'},
];

const sortDirectionOptions = [
	{label: 'Descending', value: 'desc'},
	{label: 'Ascending', value: 'asc'},
];

// Pagination
const pagination = ref({
	page: 1,
	perPage: 10,
});

const perPageOptions = [
	{label: '10 per page', value: 10},
	{label: '25 per page', value: 25},
	{label: '50 per page', value: 50},
	{label: '100 per page', value: 100},
];

// Computed properties
const filteredSubmissions = computed(() => {
	let result = [...submissions.value];

	// Filter by card type
	if (filters.value.cardType !== 'all') {
		result = result.filter(submission => submission.cardType === filters.value.cardType);
	}

	// Filter by search term
	if (filters.value.search) {
		const searchTerm = filters.value.search.toLowerCase();
		result = result.filter(submission =>
				submission.text.toLowerCase().includes(searchTerm) ||
				submission.submitterName.toLowerCase().includes(searchTerm)
		);
	}

	// Sort submissions
	result.sort((a, b) => {
		let valueA, valueB;

		switch (filters.value.sortBy) {
			case 'timestamp':
				valueA = new Date(a.timestamp).getTime();
				valueB = new Date(b.timestamp).getTime();
				break;
			case 'upvotes':
				valueA = a.upvotes;
				valueB = b.upvotes;
				break;
			case 'textLength':
				valueA = a.text.length;
				valueB = b.text.length;
				break;
			case 'pick':
				valueA = a.pick || 1;
				valueB = b.pick || 1;
				break;
			default:
				valueA = new Date(a.timestamp).getTime();
				valueB = new Date(b.timestamp).getTime();
		}

		return filters.value.sortDirection === 'asc'
				? valueA - valueB
				: valueB - valueA;
	});

	return result;
});

const pageCount = computed(() => {
	return Math.ceil(filteredSubmissions.value.length / pagination.value.perPage);
});

const paginatedSubmissions = computed(() => {
	const start = (pagination.value.page - 1) * pagination.value.perPage;
	const end = start + pagination.value.perPage;
	return filteredSubmissions.value.slice(start, end);
});

// Methods
async function fetchSubmissions() {
	if (!databases) return;

	try {
		loading.value = true;

		const response = await databases.listDocuments(
				config.public.appwriteDatabaseId,
				config.public.appwriteSubmissionCollectionId,
				[
					// If we have a last loaded ID, start after that document
					lastLoadedId.value ?
							Query.cursorAfter(lastLoadedId.value) :
							Query.orderDesc('$createdAt'),
					Query.limit(50)
				]
		);

		if (response.documents.length < 50) {
			hasMoreSubmissions.value = false;
		}

		if (response.documents.length > 0) {
			lastLoadedId.value = response.documents[response.documents.length - 1].$id;
			submissions.value = [...submissions.value, ...response.documents];
		}
	} catch (error) {
		console.error('Error fetching submissions:', error);
		useToast().add({
			title: 'Error',
			description: 'Failed to load submissions',
			color: 'error'
		});
	} finally {
		loading.value = false;
	}
}

async function loadMoreSubmissions() {
	if (hasMoreSubmissions.value && !loading.value) {
		await fetchSubmissions();
	}
}

async function handleUpvote(submissionId: string) {
	if (!isLoggedIn.value || upvoteInProgress.value) return;

	try {
		upvoteInProgress.value = true;

		// Find the submission
		const submissionIndex = submissions.value.findIndex(s => s.$id === submissionId);
		if (submissionIndex === -1) return;

		const submission = submissions.value[submissionIndex];
		const userId = userStore.user?.$id;

		if (!userId) return;

		// Check if user already upvoted
		const upvoterIds = submission.upvoterIds || [];
		const alreadyUpvoted = upvoterIds.includes(userId);

		if (alreadyUpvoted) {
			// Remove upvote
			// Update local state
			submissions.value[submissionIndex] = await databases.updateDocument(
					config.public.appwriteDatabaseId,
					config.public.appwriteSubmissionCollectionId,
					submissionId,
					{
						upvotes: submission.upvotes - 1,
						upvoterIds: upvoterIds.filter(id => id !== userId)
					}
			);
		} else {
			// Add upvote
			// Update local state
			submissions.value[submissionIndex] = await databases.updateDocument(
					config.public.appwriteDatabaseId,
					config.public.appwriteSubmissionCollectionId,
					submissionId,
					{
						upvotes: submission.upvotes + 1,
						upvoterIds: [...upvoterIds, userId]
					}
			);
		}
	} catch (error) {
		console.error('Error upvoting submission:', error);
		useToast().add({
			title: 'Error',
			description: 'Failed to update vote',
			color: 'error'
		});
	} finally {
		upvoteInProgress.value = false;
	}
}

function handleCardSubmitted(newSubmission: any) {
	// Add the new submission to the top of the list
	submissions.value.unshift(newSubmission);

	// Reset to first page if not already there
	pagination.value.page = 1;

	useToast().add({
		title: 'Success',
		description: 'Your card has been submitted!',
		color: 'success'
	});
}

async function handleDelete(submissionId: string) {
	if (!isAdmin.value) {
		useToast().add({
			title: 'Error',
			description: 'Only administrators can delete submissions',
			color: 'error'
		});
		return;
	}

	try {
		// Delete the submission from the database
		await databases.deleteDocument(
				config.public.appwriteDatabaseId,
				config.public.appwriteSubmissionCollectionId,
				submissionId
		);

		// Remove the submission from the local state
		submissions.value = submissions.value.filter(s => s.$id !== submissionId);

		useToast().add({
			title: 'Success',
			description: 'Submission deleted successfully',
			color: 'success'
		});
	} catch (error) {
		console.error('Error deleting submission:', error);
		useToast().add({
			title: 'Error',
			description: 'Failed to delete submission',
			color: 'error'
		});
	}
}

async function handleAdopt(submission: any) {
	if (!isAdmin.value) {
		useToast().add({
			title: 'Error',
			description: 'Only administrators can adopt submissions',
			color: 'error'
		});
		return;
	}

	try {
		// Determine which collection to add to based on card type
		const collectionId = submission.cardType === 'white' 
			? config.public.appwriteWhiteCardCollectionId 
			: config.public.appwriteBlackCardCollectionId;

		// Create the card data
		const cardData: any = {
			text: submission.text,
			pack: "Unfit Labs",
			active: true,
			submittedBy: submission.submitterName
		};

		// Add pick property for black cards
		if (submission.cardType === 'black' && submission.pick) {
			cardData.pick = submission.pick;
		}

		// Add the card to the appropriate collection
		await databases.createDocument(
			config.public.appwriteDatabaseId,
			collectionId,
			'unique()',
			cardData
		);

		// Delete the submission from the database
		await databases.deleteDocument(
			config.public.appwriteDatabaseId,
			config.public.appwriteSubmissionCollectionId,
			submission.$id
		);

		// Remove the submission from the local state
		submissions.value = submissions.value.filter(s => s.$id !== submission.$id);

		useToast().add({
			title: 'Success',
			description: `Card successfully adopted to the Unfit Labs pack!`,
			color: 'success'
		});
	} catch (error) {
		console.error('Error adopting submission:', error);
		useToast().add({
			title: 'Error',
			description: 'Failed to adopt submission',
			color: 'error'
		});
	}
}

// Subscribe to real-time updates
function subscribeToSubmissions() {
	if (!client) return;

	const dbId = config.public.appwriteDatabaseId;
	const collectionId = config.public.appwriteSubmissionCollectionId;

	return client.subscribe(
			[`databases.${dbId}.collections.${collectionId}.documents`],
			(response) => {
				const {events, payload} = response;

				// Handle new submissions
				if (events.some(e => e.endsWith('.create'))) {
					// Only add if it's not already in our list
					if (!submissions.value.some(s => s.$id === payload.$id)) {
						submissions.value.unshift(payload);
					}
				}

				// Handle updates (like upvotes)
				if (events.some(e => e.endsWith('.update'))) {
					const index = submissions.value.findIndex(s => s.$id === payload.$id);
					if (index !== -1) {
						submissions.value[index] = payload;
					}
				}

				// Handle deletions
				if (events.some(e => e.endsWith('.delete'))) {
					submissions.value = submissions.value.filter(s => s.$id !== payload.$id);
				}
			}
	);
}

// Lifecycle hooks
onMounted(async () => {
	await fetchSubmissions();
	const unsubscribe = subscribeToSubmissions();

	onUnmounted(() => {
		if (unsubscribe) unsubscribe();
	});
});

// Reset pagination when filters change
watch([() => filters.value.cardType, () => filters.value.search], () => {
	pagination.value.page = 1;
});
</script>
