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
					{{ t('chat.no_messages') }}
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
					:placeholder="t('chat.placeholder')"
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
				{{ t('chat.send') }}
			</UButton>
		</div>
		<div class="bottom-0 relative bg-slate-900 border-2 border-t-0 border-slate-500 w-full rounded-b-lg p-4">
			<USwitch label="TTS" :description="t('chat.tts_description')" size="xs" v-model="prefs.ttsEnabled" />
			<USwitch label="Profanity" :description="t('chat.profanity_description')" size="xs" v-model="prefs.chatProfanityFilter" />

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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { getAppwrite } from '~/utils/appwrite';
import { useUserStore } from '~/stores/userStore';
import { Filter } from 'bad-words';
import { ID, Query, Permission, Role, type Models, type Databases } from 'appwrite';
import { useBrowserSpeech } from '~/composables/useBrowserSpeech';
import { useSpeech } from '~/composables/useSpeech';
import { useUserPrefsStore } from '~/stores/userPrefsStore';

const elevenLabsVoiceId = 'NuIlfu52nTXRM2NXDrjS';
const browserSpeech = useBrowserSpeech();
const elevenLabsSpeech = useSpeech(elevenLabsVoiceId);
const prefs = useUserPrefsStore();
const { t } = useI18n();
const maxLength = 255;
const { playSfx } = useSfx();
const autoResize = (e: Event) => {
	const target = e.target as HTMLTextAreaElement;
	target.style.height = 'auto';
	target.style.height = `${target.scrollHeight}px`;
	nextTick(() => (target.scrollTop = target.scrollHeight));
};

const speak = (text: string) => {
	if (prefs.ttsVoice === elevenLabsVoiceId) {
		elevenLabsSpeech.speak(text);
	} else {
		browserSpeech.speak(text);
	}
};

interface ChatMessage extends Models.Document {
	lobbyId: string;
	senderId: string;
	senderName: string;
	text: string;
	timeStamp: string;
	type?: 'user' | 'system';
}

const props = withDefaults(
		defineProps<{
			lobbyId?: string;
		}>(),
		{
			lobbyId: '',
		}
);
const { sanitize } = useSanitize();
let databases: Databases;
if (import.meta.client) {
	({ databases } = getAppwrite());
}
const userStore = useUserStore();
const config = useRuntimeConfig();
const dbId = config.public.appwriteDatabaseId;
const messagesCollectionId = config.public.appwriteGamechatCollectionId;

const messages = ref<ChatMessage[]>([]);
const newMessage = ref('');
const safeText = (text: string) => sanitize(text);
const chatContainer = ref<HTMLDivElement | null>(null);
const isAtBottom = ref(true);
const errorMessage = ref<string | null>(null);

const isMessageEmpty = computed(() => !newMessage.value.trim());

const filter = new Filter();

function uidToHSLColor(uid: string): string {
	let hash = 0;
	for (let i = 0; i < uid.length; i++) {
		hash = uid.charCodeAt(i) + ((hash << 5) - hash);
	}

	const hue = hash % 360;
	const saturation = 65;
	const lightness = 55;

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const loadMessages = async () => {
	try {
		errorMessage.value = null;

		if (!props.lobbyId) {
			errorMessage.value = t('chat.error_loading_messages');
			return () => {};
		}

		const res = await databases.listDocuments(dbId, messagesCollectionId, [
			Query.equal('lobbyId', props.lobbyId),
			Query.orderAsc('timeStamp'),
		]);

		messages.value = res.documents.map((doc: Models.Document) => {
			const text = Array.isArray(doc.text) ? doc.text.join(' ') : doc.text;
			const safe = sanitize(text);
			return {
				...doc,
				text: prefs.chatProfanityFilter ? safe : filter.clean(safe),
			};
		}) as ChatMessage[];

		return databases.client.subscribe(
				`databases.${dbId}.collections.${messagesCollectionId}.documents`,
				(e: Models.Event) => {
					if (e.events.includes('databases.*.collections.*.documents.*.create')) {
						const doc = e.payload as ChatMessage;
						const docLobbyId =
								typeof doc.lobbyId === 'object' && (doc.lobbyId as Models.Relationship).$id
										? (doc.lobbyId as Models.Relationship).$id
										: doc.lobbyId;

						if (props.lobbyId && docLobbyId === props.lobbyId) {
							const text = Array.isArray(doc.text) ? doc.text.join(' ') : doc.text;
							const safe = sanitize(text);
							const safeDoc = {
								...doc,
								text: prefs.chatProfanityFilter ? safe : filter.clean(safe),
							};
							messages.value.push(safeDoc);
							if (safeDoc.senderId !== userStore.user?.$id) {
								playSfx('/sounds/sfx/chatReceive.wav');
							}

							if (prefs.ttsEnabled) {
								if (safeDoc.text && safeDoc.text.length > 0) {
									speak(`${safeDoc.senderName} says: ${safeDoc.text}`);
								}
							}
						}
					}
				}
		);
	} catch (error) {
		errorMessage.value = t('chat.error_loading_messages');
		return () => {};
	}
};

const scrollToBottom = () => {
	if (!chatContainer.value) return;
	chatContainer.value.scrollTo({
		top: chatContainer.value.scrollHeight,
		behavior: 'smooth',
	});
	isAtBottom.value = true;
};

const checkIfAtBottom = () => {
	if (!chatContainer.value) return;
	const { scrollTop, scrollHeight, clientHeight } = chatContainer.value;
	isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50;
};

const handleScroll = () => {
	checkIfAtBottom();
};

watch(messages, () => {
	nextTick(() => {
		if (chatContainer.value && isAtBottom.value) {
			scrollToBottom();
		}
	});
});

const chatInput = ref<HTMLTextAreaElement | null>(null);

const sendMessage = async () => {
	const trimmedMessage = newMessage.value.trim();
	if (!trimmedMessage) return;

	const stripWeirdUnicode = (str: string) =>
			str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

	const safeMessage = sanitize(stripWeirdUnicode(trimmedMessage));
	if (!safeMessage) return;

	const truncatedMessage = safeMessage.substring(0, maxLength);

	try {
		errorMessage.value = null;
		const userId = userStore.user?.$id || 'anonymous';

		const permissions = [
			Permission.read(Role.any()),
			Permission.update(Role.user(userId)),
			Permission.delete(Role.user(userId)),
		];

		await databases.createDocument(
				dbId,
				messagesCollectionId,
				ID.unique(),
				{
					lobbyId: props.lobbyId,
					senderId: userId,
					senderName: userStore.user?.name || userStore.user?.prefs?.name || 'Anonymous',
					text: truncatedMessage,
					timeStamp: new Date().toISOString(),
				},
				permissions
		);

		newMessage.value = '';

		await nextTick(() => {
			scrollToBottom();
			playSfx('/sounds/sfx/chatSend.wav');
		});
	} catch (error: any) {
		if (error?.message) {
			errorMessage.value = `${t('chat.error_sending')}: ${error.message}`;
		} else {
			errorMessage.value = t('chat.error_sending');
		}
	}
};

let unsubscribe: (() => void) | null = null;

onMounted(() => {
	nextTick(() => {
		scrollToBottom();
	});

	loadMessages().then((unsub) => {
		unsubscribe = unsub;
	});
});

onUnmounted(() => {
	if (unsubscribe) unsubscribe();
});
</script>