<template>
	<div class="flex flex-col h-full w-1/4 border rounded-lg overflow-hidden bg-gray-900 shadow-lg mx-auto">
		<!-- Chat messages -->
		<div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-3">
			<div v-for="msg in messages" :key="msg.$id" class="text-sm">
				<span class="font-bold text-primary-400">{{ msg.senderName }}:</span>
				<span class="text-gray-300">{{ msg.text }}</span>
			</div>
		</div>

		<!-- Chat input -->
		<div class="flex p-2 border-t border-gray-700 bg-gray-800">
			<input
					v-model="newMessage"
					@keyup.enter="sendMessage"
					type="text"
					placeholder="Type a message..."
					class="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
			/>
			<button @click="sendMessage" class="ml-2 px-4 py-2 rounded bg-primary-500 hover:bg-primary-600 text-white">
				Send
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAppwrite } from '~/composables/useAppwrite'; // Assuming you have a helper composable
import { Filter } from 'bad-words';

const props = defineProps<{
	lobbyId: string;
}>();

const { databases } = useAppwrite(); // Your Appwrite client setup
const dbId = 'YOUR_DB_ID';
const messagesCollectionId = 'YOUR_MESSAGES_COLLECTION_ID';

const messages = ref<any[]>([]);
const newMessage = ref('');

const chatContainer = ref<HTMLDivElement | null>(null);

// Bad-words filter setup
const filter = new Filter();

// Fetch and subscribe to messages
const loadMessages = async () => {
	const res = await databases.listDocuments(dbId, messagesCollectionId, [
		Query.equal('lobbyId', props.lobbyId),
		Query.orderAsc('timestamp')
	]);
	messages.value = res.documents;

	// Subscribe to new messages
	const unsub = databases.client.subscribe(`databases.${dbId}.collections.${messagesCollectionId}.documents`, (e) => {
		if (e.events.includes('databases.*.collections.*.documents.*.create')) {
			const doc = e.payload;
			if (doc.lobbyId === props.lobbyId) {
				messages.value.push(doc);
			}
		}
	});
};

// Auto-scroll to bottom when new message
watch(messages, () => {
	nextTick(() => {
		if (chatContainer.value) {
			chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
		}
	});
});

const sendMessage = async () => {
	const cleanText = filter.clean(newMessage.value.trim());
	if (!cleanText) return;

	await databases.createDocument(dbId, messagesCollectionId, ID.unique(), {
		lobbyId: props.lobbyId,
		senderId: 'CURRENT_USER_ID', // You should dynamically inject this
		senderName: 'CURRENT_USER_NAME', // You should dynamically inject this
		text: cleanText,
		timestamp: new Date().toISOString(),
	});

	newMessage.value = '';
};

onMounted(loadMessages);
</script>

<style scoped>
/* You can tweak these */
</style>
