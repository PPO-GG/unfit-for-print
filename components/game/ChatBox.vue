<template>
	<div class="font-['Bebas_Neue'] bg-slate-600 rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto border-2 border-slate-500">
		<!-- Error message display -->
		<div v-if="errorMessage" class="bg-red-500 text-white p-2 mb-2 rounded text-sm">
			{{ errorMessage }}
		</div>

		<!-- Chat messages -->
		<div class="relative">
			<div 
				ref="chatContainer" 
				@scroll="handleScroll" 
				class="flex-1 overflow-y-auto p-2 space-y-1 max-h-80 border-2 border-b-0 border-slate-500 bg-slate-800 rounded-t-lg"
			>
    <div v-for="(msg, index) in messages" :key="msg.$id" class="break-words whitespace-pre-wrap px-2">
					<!-- System messages -->
					<template v-if="msg.senderId === 'system'">
						<span class="text-yellow-300 xl:text-xl md:text-lg">{{ safeText(msg.text) }}</span>
					</template>
					<!-- User messages -->
					<template v-else>
						<span class="font-light mr-1 xl:text-xl md:text-lg" :style="{ color: uidToHSLColor(msg.senderId) }">{{ msg.senderName }}:</span>
						<span class="text-slate-300 xl:text-xl md:text-lg">{{ safeText(msg.text) }}</span>
					</template>
					<USeparator
							v-if="index !== messages.length - 1"
							color="secondary"
							type="solid"
							class="h-2 opacity-50"
					/>
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
		<div class="flex p-2 border-2  border-slate-500 bg-slate-800">
			<textarea
					ref="chatInput"
					v-model="newMessage"
					@keydown.enter.exact.prevent="!isMessageEmpty && sendMessage()"
					placeholder="Type a message..."
					rows="1"
					class="flex-1 resize-none bg-transparent outline-none text-white placeholder-gray-400 overflow-hidden px-2"
					@input="autoResize"
					:maxlength="maxLength"
					aria-describedby="character-count"
			/>
			<UButton
				@click="sendMessage"
				:disabled="isMessageEmpty"
				variant="subtle"
				color="secondary"
				class="disabled:bg-gray-500 disabled:cursor-not-allowed disabled:text-gray-400 p-2"
				icon="i-solar-plain-bold-duotone"
			>
				Send
			</UButton>
		</div>
		<div class="bottom-0 relative bg-slate-900 border-2 border-t-0 border-slate-500 w-full rounded-b-lg p-4">
			<USwitch label="TTS" description="This toggles text-to-speech" size="xs" v-model="prefs.ttsEnabled" />
			<USwitch label="Profanity" description="This toggles profanity filtering" size="xs" v-model="prefs.chatProfanityFilter" />

			<div
					id="character-count"
					class="text-xs text-muted tabular-nums absolute bottom-2 right-2"
					aria-live="polite"
					role="status"
			>
				{{ newMessage?.length }}/{{ maxLength }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue';
import {useAppwrite} from '~/composables/useAppwrite';
import {useUserStore} from '~/stores/userStore';
import {Filter} from 'bad-words';
import {ID, type Models, Query, Permission, Role} from 'appwrite';
import { useMeSpeak } from '~/composables/useMeSpeak'
const { speakWithUserId } = await useMeSpeak()
const prefs = useUserPrefsStore()

import { useSpeech } from '~/composables/useSpeech'
const {speak} = useSpeech('NuIlfu52nTXRM2NXDrjS')

const maxLength = 256
const {playSfx} = useSfx();
const autoResize = (e: Event) => {
	const target = e.target as HTMLTextAreaElement
	target.style.height = 'auto'
	target.style.height = `${target.scrollHeight}px`
	nextTick(() => target.scrollTop = target.scrollHeight)
}

// Define a proper interface for chat messages
interface ChatMessage extends Models.Document {
  lobbyId: string;
  senderId: string;
  senderName: string;
  text: string[];
  timestamp: string;
	type?: 'user' | 'system';
}


const props = withDefaults(defineProps<{
	lobbyId?: string;
}>(), {
	lobbyId: ''
});
const { sanitize } = useSanitize()
const { databases } = useAppwrite();
const userStore = useUserStore();
const config = useRuntimeConfig();
const dbId = config.public.appwriteDatabaseId;
const messagesCollectionId = config.public.appwriteGamechatCollectionId;

const messages = ref<ChatMessage[]>([]);
const newMessage = ref('');
const safeText = (text: string[]) => text.map(t => sanitize(t)).join(' ')
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

		// Check if lobbyId is defined and not empty
		if (!props.lobbyId) {
			console.error('Error: lobbyId is undefined or empty');
			errorMessage.value = 'Failed to load messages: Invalid lobby ID';
			return () => {};
		}

		const res = await databases.listDocuments(dbId, messagesCollectionId, [
			Query.equal('lobbyId', props.lobbyId),
			Query.orderAsc('timestamp')
		]);

		messages.value = res.documents.map((doc) => ({
			...doc,
			text: doc.text.map((t) => {
				const safe = sanitize(t);
				return prefs.chatProfanityFilter ? safe : filter.clean(safe);
			}),
		})) as ChatMessage[];

		// Subscribe to new messages
		return databases.client.subscribe(`databases.${dbId}.collections.${messagesCollectionId}.documents`, (e) => {
			if (e.events.includes('databases.*.collections.*.documents.*.create')) {
				const doc = e.payload as ChatMessage;
				// Check if lobbyId is defined and matches the document's lobbyId
				// Handle case where doc.lobbyId is a relationship object
				const docLobbyId = typeof doc.lobbyId === 'object' && doc.lobbyId?.$id 
					? doc.lobbyId.$id 
					: doc.lobbyId;

				if (props.lobbyId && docLobbyId === props.lobbyId) {
					const safeDoc = {
						...doc,
						text: doc.text.map((t) => {
							const safe = sanitize(t);
							return prefs.chatProfanityFilter ? safe : filter.clean(safe);
						}),
					};
					messages.value.push(safeDoc);
					if(safeDoc.senderId !== userStore.user?.$id) {
						playSfx('/sounds/sfx/chatReceive.wav');
					}

					if (prefs.ttsEnabled) {
						if(safeDoc.senderId !== userStore.user?.$id && safeDoc.text && safeDoc.text.length > 0) {
							// speakWithUserId(safeDoc.text.join(' '), safeDoc.senderId);
							speak(safeDoc.text.join(' '))
						}
					}
				}
			}
		});
	} catch (error) {
		console.error('Error loading or subscribing to messages:', error);
		errorMessage.value = 'Failed to load messages. Please try refreshing the page.';
		return () => {};
	}
};

// Scroll to bottom function that can be called manually or automatically
const scrollToBottom = () => {
	if (!chatContainer.value) return;
	chatContainer.value.scrollTo({
		top: chatContainer.value.scrollHeight,
		behavior: 'smooth',
	})
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

const chatInput = ref<HTMLTextAreaElement | null>(null)

const sendMessage = async () => {
	// Check for empty message first before processing
	const trimmedMessage = newMessage.value.trim()
	if (!trimmedMessage) return

	const stripWeirdUnicode = (str: string) =>
			str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')

	const safeMessage = sanitize(stripWeirdUnicode(trimmedMessage))
	if (!safeMessage) return

	try {
		errorMessage.value = null
		const userId = userStore.user?.$id || 'anonymous'

		const permissions = [
			Permission.read(Role.any()),
			Permission.update(Role.user(userId)),
			Permission.delete(Role.user(userId)),
		]

		await databases.createDocument(dbId, messagesCollectionId, ID.unique(), {
			lobbyId: props.lobbyId,
			senderId: userId,
			senderName: userStore.user?.name || userStore.user?.prefs?.name || 'Anonymous',
			text: [safeMessage],
			timestamp: new Date().toISOString(),
		}, permissions)

		newMessage.value = ''

		await nextTick(() => {
			scrollToBottom()
			playSfx('/sounds/sfx/chatSend.wav')
		})
	} catch (error) {
		console.error('Error sending message:', error)
		errorMessage.value = 'Failed to send message. Please try again.'
	}
	if (!safeMessage) {
		errorMessage.value = 'Your message contained unsupported or unsafe content.'
		return
	}
}


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
