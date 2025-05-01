<template>
	<div class="font-['Bebas_Neue'] bg-slate-600 rounded-xl p-6 shadow-lg w-full mx-auto">
		<!-- Error message display -->
		<div v-if="errorMessage" class="bg-red-500 text-white p-2 mb-2 rounded text-sm">
			{{ errorMessage }}
		</div>

		<!-- Chat messages -->
		<div class="relative">
			<div 
				ref="chatContainer" 
				@scroll="handleScroll" 
				class="flex-1 overflow-y-auto p-4 space-y-3 max-h-80"
			>
				<div v-for="msg in messages" :key="msg.$id" class="text-lg">
					<span class="font-light mr-1" :style="{ color: uidToHSLColor(msg.senderId) }">{{ msg.senderName }}:</span>
					<span class="text-slate-300">{{ msg.text.join(' ') }}</span>
				</div>
				<div v-if="messages.length === 0" class="text-gray-400 text-center italic">
					No messages yet
				</div>
			</div>

			<!-- Scroll to bottom button - only visible when not at bottom -->
			<button 
				v-if="!isAtBottom" 
				@click="scrollToBottom" 
				class="absolute bottom-2 right-2 bg-primary-500 hover:bg-primary-600 text-white rounded-full p-2 shadow-lg"
				title="Scroll to bottom"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clip-rule="evenodd" transform="rotate(180 10 10)" />
				</svg>
			</button>
		</div>

		<!-- Chat input -->
		<div class="flex p-2 border-t border-gray-700 bg-gray-800">
			<input
					v-model="newMessage"
					@keyup.enter="!isMessageEmpty && sendMessage()"
					type="text"
					placeholder="Type a message..."
					class="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
			/>
			<button 
				@click="sendMessage" 
				:disabled="isMessageEmpty"
				class="ml-2 px-4 py-2 rounded bg-primary-500 hover:bg-primary-600 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
			>
				Send
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue';
import {useAppwrite} from '~/composables/useAppwrite';
import {useUserStore} from '~/stores/userStore';
import {Filter} from 'bad-words';
import {ID, type Models, Query} from 'appwrite';

// Define a proper interface for chat messages
interface ChatMessage extends Models.Document {
  lobbyId: string;
  senderId: string;
  senderName: string;
  text: string[];
  timestamp: string;
}

const props = defineProps<{
	lobbyId: string;
}>();

const { databases } = useAppwrite();
const userStore = useUserStore();
const config = useRuntimeConfig();
const dbId = config.public.appwriteDatabaseId;
const messagesCollectionId = config.public.appwriteGamechatCollectionId;

const messages = ref<ChatMessage[]>([]);
const newMessage = ref('');
const chatContainer = ref<HTMLDivElement | null>(null);
const isAtBottom = ref(true);
const errorMessage = ref<string | null>(null);

// Computed property to check if the message input is empty
const isMessageEmpty = computed(() => !newMessage.value.trim());

// Bad-words filter setup
const filter = new Filter();

function uidToHSLColor(uid: string): string {
	// Simple hash of UID to number
	let hash = 0;
	for (let i = 0; i < uid.length; i++) {
		hash = uid.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Convert hash to hue (0–360)
	const hue = hash % 360;
	const saturation = 65; // %
	const lightness = 55;  // %

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Fetch and subscribe to messages
const loadMessages = async () => {
	try {
		errorMessage.value = null;
		const res = await databases.listDocuments(dbId, messagesCollectionId, [
			Query.equal('lobbyId', props.lobbyId),
			Query.orderAsc('timestamp')
		]);
		messages.value = res.documents as ChatMessage[];

		// Subscribe to new messages
		return databases.client.subscribe(`databases.${dbId}.collections.${messagesCollectionId}.documents`, (e) => {
			if (e.events.includes('databases.*.collections.*.documents.*.create')) {
				const doc = e.payload as ChatMessage;
				if (doc.lobbyId === props.lobbyId) {
					messages.value.push(doc);
				}
			}
		});
	} catch (error) {
		console.error('Error loading or subscribing to messages:', error);
		errorMessage.value = 'Failed to load messages. Please try refreshing the page.';
		return () => {}; // Return empty function as fallback
	}
};

// Scroll to bottom function that can be called manually or automatically
const scrollToBottom = () => {
	if (!chatContainer.value) return;
	chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
	isAtBottom.value = true;
};

// Track if user is scrolled to bottom
const checkIfAtBottom = () => {
	if (!chatContainer.value) return;
	const { scrollTop, scrollHeight, clientHeight } = chatContainer.value;
	// Consider "at bottom" if within 50px of the bottom
	isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50;
};

// Handle scroll events to detect if user has scrolled up
const handleScroll = () => {
	checkIfAtBottom();
};

// Auto-scroll to bottom when new message (only if user was already at bottom)
watch(messages, () => {
	nextTick(() => {
		if (chatContainer.value && isAtBottom.value) {
			scrollToBottom();
		}
	});
});

const sendMessage = async () => {
	// Check for empty message first before processing
	const trimmedMessage = newMessage.value.trim();
	if (!trimmedMessage) return;

	// Apply bad-words filter
	const cleanText = filter.clean(trimmedMessage);
	if (!cleanText) return;

	try {
		errorMessage.value = null;
		await databases.createDocument(dbId, messagesCollectionId, ID.unique(), {
			lobbyId: props.lobbyId,
			senderId: userStore.user?.$id || 'anonymous',
			senderName: userStore.user?.name || userStore.user?.prefs?.name || 'Anonymous',
			text: [trimmedMessage],
			timestamp: new Date().toISOString(),
		});

		newMessage.value = '';

		// Force scroll to bottom when user sends a message
		await nextTick(() => {
			scrollToBottom();
		});
	} catch (error) {
		console.error('Error sending message:', error);
		errorMessage.value = 'Failed to send message. Please try again.';
	}
};

let unsubscribe: (() => void) | null = null;

onMounted(() => {
	// Initialize scroll position
	nextTick(() => {
		scrollToBottom();
	});

	// Load messages and set up subscription
	loadMessages().then((unsub) => {
		unsubscribe = unsub;
	});
});

onUnmounted(() => {
	if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
/* You can tweak these */
</style>
