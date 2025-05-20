import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { Filter } from 'bad-words'
import { useSanitize } from '~/composables/useSanitize'
import { useSpeech } from '~/composables/useSpeech'
import { useSfx } from '~/composables/useSfx'

interface MessageEvent {
  _id: string
  rid: string
  msg: string
  ts: string
  u: { _id: string, username: string }
  isSystem?: boolean
}

export function useRocketSocket(lobbyId: string, nickname: string, currentUserId: string) {
  const messages = ref<MessageEvent[]>([])
  const socket = new WebSocket('wss://chat.ppo.gg/websocket')
  const connected = ref(false)
  const isLoggedIn = ref(false)
  const subId = `sub-${Math.random().toString(36).slice(2)}`
  const loading = ref(true)
  const error = ref<string | null>(null)
  const newMessage = ref('')
  const roomId = ref<string>('')

  const prefs = useUserPrefsStore()
  const { sanitize } = useSanitize()
  const { speak } = useSpeech('NuIlfu52nTXRM2NXDrjS')
  const { playSfx } = useSfx()
  const filter = new Filter()

  const isMessageEmpty = computed(() => !newMessage.value.trim())
  const isAtBottom = ref(true)

  const roomName = `lobby-${lobbyId}`
  const config = useRuntimeConfig()
  const BOT_TOKEN = config.public.rocketchatBotToken
  const BOT_USER_ID = config.public.rocketchatBotUserId

  let pingInterval: NodeJS.Timeout

  const send = (data: any) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data))
    }
  }

  async function fetchMessages() {
    if (!roomId.value) return
    try {
      const response = await $fetch(`/api/chat/messages`, {
        params: { roomId: roomId.value },
      })

      const processed = (response?.messages || []).map((msg: any) => {
        const isSystem = msg.msg.startsWith('[System]:')
        let processedMsg = msg.msg

        if (!isSystem && prefs.chatProfanityFilter) {
          const match = processedMsg.match(/^\[(.*?)\]:(.*)$/)
          if (match) {
            const filtered = filter.clean(sanitize(match[2]))
            processedMsg = `[${match[1]}]:${filtered}`
          } else {
            processedMsg = filter.clean(sanitize(processedMsg))
          }
        }

        return { ...msg, msg: processedMsg, isSystem }
      })

      messages.value = processed.reverse()
    } catch (err) {
      console.error('[RocketSocket] fetchMessages failed:', err)
      error.value = 'Failed to load messages'
    }
  }

  async function getRoomIdByName() {
    try {
      const response = await $fetch(`/api/chat/room-info`, {
        params: { roomName },
      })

      if (response?.group?._id) {
        roomId.value = response.group._id
        await fetchMessages()
      } else {
        await createRoom()
      }
    } catch {
      await createRoom()
    }
  }

  async function createRoom() {
    try {
      const response = await $fetch(`/api/chat/create-room`, {
        method: 'POST',
        body: { name: roomName },
      })

      if (response?.group?._id) {
        roomId.value = response.group._id
        await fetchMessages()
      } else {
        error.value = 'Failed to create room'
      }
    } catch (err) {
      error.value = 'Error creating room'
      console.error(err)
    }
  }

  async function sendMessage() {
    if (!newMessage.value.trim() || !roomId.value) return

    const clean = sanitize(newMessage.value.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim())
    if (!clean) return

    try {
      await $fetch(`/api/chat/post-message`, {
        method: 'POST',
        body: {
          roomId: roomId.value,
          text: `[${nickname}]: ${clean}`,
        },
      })
      newMessage.value = ''
      playSfx('/sounds/sfx/chatSend.wav')
    } catch (err) {
      error.value = 'Failed to send message'
      console.error(err)
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
    } catch (err) {
      error.value = 'Failed to send system message'
      console.error(err)
    }
  }

  function uidToHSLColor(uid: string): string {
    let hash = 0
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash)
    }
    return `hsl(${hash % 360}, 65%, 55%)`
  }

  socket.addEventListener('open', () => {
    connected.value = true
    send({ msg: 'connect', version: '1', support: ['1'] })
  })

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data)

    if (data.msg === 'connected') {
      send({
        msg: 'method',
        method: 'login',
        id: '42',
        params: [{ resume: BOT_TOKEN }]
      })
    }

    if (data.msg === 'result' && data.id === '42') {
      isLoggedIn.value = true
      pingInterval = setInterval(() => send({ msg: 'ping' }), 30000)
      loading.value = false
    }

    if (data.msg === 'ping') {
      send({ msg: 'pong' })
    }

    if (data.msg === 'changed' && data.collection === 'stream-room-messages') {
      const msg = data.fields.args[0]
      const isSystem = msg.msg.startsWith('[System]:')

      let processedMsg = msg.msg
      if (!isSystem && prefs.chatProfanityFilter) {
        const match = processedMsg.match(/^\[(.*?)\]:(.*)$/)
        if (match) {
          const filtered = filter.clean(sanitize(match[2]))
          processedMsg = `[${match[1]}]:${filtered}`
        } else {
          processedMsg = filter.clean(sanitize(processedMsg))
        }
      }

      messages.value.push({ ...msg, msg: processedMsg, isSystem })

      if (!msg.msg.startsWith(`[${nickname}]:`)) {
        playSfx('/sounds/sfx/chatReceive.wav')
        if (prefs.ttsEnabled) {
          const match = msg.msg.match(/^\[(.*?)\]:(.*)$/)
          if (match) speak(match[2].trim())
        }
      }
    }
  })

  socket.addEventListener('error', (event) => {
    error.value = 'Connection error. Please try refreshing.'
    console.error('[RocketSocket] Error:', event)
  })

  socket.addEventListener('close', () => {
    connected.value = false
    clearInterval(pingInterval)
  })

  watch([isLoggedIn, roomId], ([loggedIn, rid]) => {
    if (loggedIn && rid && connected.value) {
      // Join the room explicitly (required for stream-room-messages to fire)
      send({
        msg: 'method',
        method: 'joinRoom',
        id: 'join-' + rid,
        params: [rid]
      })

      // Subscribe to messages in the room
      send({
        msg: 'sub',
        id: subId,
        name: 'stream-room-messages',
        params: [rid, false]
      })
    }
  })

  onMounted(() => {
    getRoomIdByName()
  })

  onUnmounted(() => {
    clearInterval(pingInterval)
    socket.close()
  })

  return {
    messages,
    loading,
    error,
    newMessage,
    sendMessage,
    sendSystemMessage,
    isMessageEmpty,
    isAtBottom,
    uidToHSLColor,
  }
}
