<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useUserStore } from '~/stores/userStore';
import { useLobbyChat } from '~/composables/useRocketChat';
import { useUserPrefsStore } from '~/stores/userPrefsStore';

const props = withDefaults(defineProps<{
  lobbyId?: string;
  currentUserId?: string;
}>(), {
  lobbyId: '',
  currentUserId: ''
});

const userStore = useUserStore();
const prefs = useUserPrefsStore();

// Get the user's nickname
const nickname = computed(() => 
  userStore.user?.name || userStore.user?.prefs?.name || 'Anonymous'
);

// Use the RocketChat composable with polling
const {
  messages,
  loading,
  error,
  newMessage,
  sendMessage,
  sendSystemMessage,
  isMessageEmpty,
  isAtBottom,
  uidToHSLColor,
} = useLobbyChat(props.lobbyId, nickname.value, props.currentUserId);

// Chat container ref for scrolling
const chatContainer = ref<HTMLDivElement | null>(null);
const chatInput = ref<HTMLTextAreaElement | null>(null);
const maxLength = 256;

// Auto-resize textarea
const autoResize = (e: Event) => {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = 'auto';
  target.style.height = `${target.scrollHeight}px`;
  nextTick(() => target.scrollTop = target.scrollHeight);
};

// Scroll to bottom function
const scrollToBottom = () => {
  if (!chatContainer.value) return;
  chatContainer.value.scrollTo({
    top: chatContainer.value.scrollHeight,
    behavior: 'smooth',
  });
  isAtBottom.value = true;
};

// Track if user is scrolled to bottom
const checkIfAtBottom = () => {
  if (!chatContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = chatContainer.value;
  // Consider "at bottom" if within 50px of the bottom
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50;
};

// Handle scroll events
const handleScroll = () => {
  checkIfAtBottom();
};

// Auto-scroll to bottom when new messages arrive (if already at bottom)
watch(messages, () => {
  nextTick(() => {
    if (chatContainer.value && isAtBottom.value) {
      scrollToBottom();
    }
  });
});

// Extract username and message from RocketChat format
const parseMessage = (msg: string) => {
  const match = msg.match(/^\[(.*?)\]:(.*)$/);
  if (match) {
    return {
      username: match[1].trim(),
      text: match[2].trim()
    };
  }
  return {
    username: '',
    text: msg
  };
};

// Initialize scroll position on mount
onMounted(() => {
  nextTick(() => {
    scrollToBottom();
  });
});
</script>

<template>
  <div class="font-['Bebas_Neue'] bg-slate-600 rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto border-2 border-slate-500">
    <!-- Error message display -->
    <div v-if="error" class="bg-red-500 text-white p-2 mb-2 rounded text-sm">
      {{ error }}
    </div>

    <!-- Chat messages -->
    <div class="relative">
      <div 
        ref="chatContainer" 
        @scroll="handleScroll" 
        class="flex-1 overflow-y-auto p-2 space-y-1 max-h-80 border-2 border-b-0 border-slate-500 bg-slate-800 rounded-t-lg"
      >
        <div v-if="loading" class="text-white text-center">Loading chat…</div>
        <div v-for="(msg, index) in messages" :key="msg._id" class="break-words whitespace-pre-wrap px-2">
          <!-- System messages -->
          <template v-if="msg.isSystem">
            <span class="text-yellow-300 xl:text-xl md:text-lg">{{ parseMessage(msg.msg).text }}</span>
          </template>
          <!-- User messages -->
          <template v-else>
            <span 
              class="font-light mr-1 xl:text-xl md:text-lg" 
              :style="{ color: uidToHSLColor(parseMessage(msg.msg).username) }"
            >
              {{ parseMessage(msg.msg).username }}:
            </span>
            <span class="text-slate-300 xl:text-xl md:text-lg">{{ parseMessage(msg.msg).text }}</span>
          </template>
          <USeparator
            v-if="index !== messages.length - 1"
            color="secondary"
            type="solid"
            class="h-2 opacity-50"
          />
        </div>
        <div v-if="messages.length === 0 && !loading" class="text-gray-400 text-center italic">
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
    <div class="flex p-2 border-2 border-slate-500 bg-slate-800">
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
