// composables/useRocketChat.ts
import { ref, onMounted, watch, computed } from 'vue'
import { Filter } from 'bad-words'
import { useSanitize } from '~/composables/useSanitize'
import { useSpeech } from '~/composables/useSpeech'
import { useSfx } from '~/composables/useSfx'

interface ChatMessage {
    _id: string
    msg: string
    ts: string
    u: {
        _id: string
        username: string
    }
    isSystem?: boolean
}


export function useLobbyChat(lobbyId: string, nickname: string, currentUserId: string) {
    const config = useRuntimeConfig()
    const BOT_TOKEN = config.public.rocketchatBotToken
    const BOT_USER_ID = config.public.rocketchatBotUserId
    const POLLING_INTERVAL = 3000 // Poll for new messages every 3 seconds

    const { sanitize } = useSanitize()
    const { speak } = useSpeech('NuIlfu52nTXRM2NXDrjS')
    const { playSfx } = useSfx()
    const filter = new Filter()

    const messages = ref<ChatMessage[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    const newMessage = ref('')
    const lastMessageId = ref<string | null>(null)
    const pollingInterval = ref<NodeJS.Timeout | null>(null)
    const isAtBottom = ref(true)

    // Get user preferences from store
    const prefs = useUserPrefsStore()

    const roomName = `lobby-${lobbyId}`
    const roomId = ref<string>('')

    // Computed property to check if the message input is empty
    const isMessageEmpty = computed(() => !newMessage.value.trim())

    async function getRoomIdByName() {
        try {
            const response = await $fetch(`/api/chat/room-info`, {
                params: {
                    roomName,
                },
            })

            if (response?.group?._id) {
                roomId.value = response.group._id
            } else {
                await createRoom()
            }
        } catch (err) {
            error.value = 'Failed to get room info'
            console.error('Error getting room info:', err)
        }
    }

    async function createRoom() {
        try {
            const response = await $fetch(`/api/chat/create-room`, {
                method: 'POST',
                body: {
                    name: roomName,
                },
            })

            if (response?.group?._id) {
                roomId.value = response.group._id
            } else {
                error.value = 'Failed to create room'
            }
        } catch (err) {
            error.value = 'Failed to create room'
            console.error('Error creating room:', err)
        }
    }

    async function fetchMessages(isInitialLoad = false) {
        if (!roomId.value) return

        // Only set loading to true for initial load
        if (isInitialLoad) {
            loading.value = true
        }

        try {
            const response = await $fetch(`/api/chat/messages`, {
                params: {
                    roomId: roomId.value,
                },
            })

            const newMessages = response?.messages || []

            // Process new messages
            if (newMessages.length > 0) {
                // Sort messages by timestamp (newest first) to get the most recent one
                const sortedNewMessages = [...newMessages].sort((a, b) => 
                    new Date(b.ts).getTime() - new Date(a.ts).getTime()
                )

                // Get the most recent message
                const mostRecentMessage = sortedNewMessages[0]

                // Check if we have new messages by comparing with the last message ID
                // Only consider it a new message if:
                // 1. We don't have a lastMessageId yet (first load)
                // 2. The most recent message has a different ID than our last known message
                const hasNewMessages = !lastMessageId.value || 
                    (mostRecentMessage._id !== lastMessageId.value)

                if (hasNewMessages) {
                    // Process messages
                    const processedMessages = newMessages.map(msg => {
                        // Check if this is a system message (starts with [System]:)
                        const isSystem = msg.msg.startsWith('[System]:')

                        // Apply profanity filter if enabled
                        let processedMsg = msg.msg
                        if (!isSystem && prefs.chatProfanityFilter) {
                            // Extract username part if it exists
                            const match = processedMsg.match(/^\[(.*?)\]:(.*)$/)
                            if (match) {
                                const username = match[1]
                                const messageText = match[2]
                                const filteredText = filter.clean(sanitize(messageText))
                                processedMsg = `[${username}]:${filteredText}`
                            } else {
                                processedMsg = filter.clean(sanitize(processedMsg))
                            }
                        }

                        return {
                            ...msg,
                            msg: processedMsg,
                            isSystem
                        }
                    })

                    // Sort messages by timestamp (oldest first)
                    processedMessages.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

                    // Update messages
                    messages.value = processedMessages

                    // Store the ID of the most recent message
                    if (newMessages.length > 0) {
                        const previousLastMessageId = lastMessageId.value
                        lastMessageId.value = mostRecentMessage._id

                        // Only play sound if this is not the first load and we have actual new messages
                        if (previousLastMessageId && hasNewMessages) {
                            // Play sound for new messages (only if not from current user)
                            const latestMsg = mostRecentMessage
                            const isFromCurrentUser = latestMsg.msg.startsWith(`[${nickname}]:`)

                            if (!isFromCurrentUser) {
                                playSfx('/sounds/sfx/chatReceive.wav')

                                // TTS for new messages if enabled
                                if (prefs.ttsEnabled) {
                                    // Extract the actual message content
                                    const match = latestMsg.msg.match(/^\[(.*?)\]:(.*)$/)
                                    if (match) {
                                        const messageText = match[2].trim()
                                        speak(messageText)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            error.value = 'Failed to load messages'
            console.error('Error fetching messages:', err)
        } finally {
            loading.value = false
        }
    }

    async function sendMessage() {
        if (!newMessage.value.trim() || !roomId.value) return

        const stripWeirdUnicode = (str: string) =>
            str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')

        const safeMessage = sanitize(stripWeirdUnicode(newMessage.value.trim()))
        if (!safeMessage) return

        try {
            await $fetch(`/api/chat/post-message`, {
                method: 'POST',
                body: {
                    roomId: roomId.value,
                    text: `[${nickname}]: ${safeMessage}`,
                },
            })

            newMessage.value = ''
            playSfx('/sounds/sfx/chatSend.wav')
            await fetchMessages(false)
        } catch (err) {
            error.value = 'Failed to send message'
            console.error('Error sending message:', err)
        }
    }

    async function sendSystemMessage(message: string) {
        if (!roomId.value) return

        try {
            await $fetch(`/api/chat/post-message`, {
                method: 'POST',
                body: {
                    roomId: roomId.value,
                    text: `[System]: ${message}`,
                },
            })

            await fetchMessages(false)
        } catch (err) {
            error.value = 'Failed to send system message'
            console.error('Error sending system message:', err)
        }
    }

    function startPolling() {
        // Clear any existing interval
        if (pollingInterval.value) {
            clearInterval(pollingInterval.value)
        }

        // Set up polling for new messages (not initial load)
        pollingInterval.value = setInterval(() => fetchMessages(false), POLLING_INTERVAL)
    }

    function stopPolling() {
        if (pollingInterval.value) {
            clearInterval(pollingInterval.value)
            pollingInterval.value = null
        }
    }

    // Function to convert user ID to a consistent color
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

    onMounted(async () => {
        await getRoomIdByName()
        await fetchMessages(true) // Initial load
        startPolling()
    })

    // Clean up on component unmount
    onUnmounted(() => {
        stopPolling()
    })

    return {
        messages,
        loading,
        error,
        newMessage,
        sendMessage,
        sendSystemMessage,
        fetchMessages,
        isMessageEmpty,
        isAtBottom,
        uidToHSLColor,
    }
}
