export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()

    const response = await $fetch('https://chat.ppo.gg/api/v1/chat.postMessage', {
      method: 'POST',
      headers: {
        'X-Auth-Token': config.rocketchatBotToken,
        'X-User-Id': config.rocketchatBotUserId,
        'Content-Type': 'application/json',
      },
      body: {
        roomId: body.roomId,
        text: body.text,
      },
    })

    return response
  } catch (error) {
    // Return a structured error response
    throw createError({
      statusCode: error.response?.status || 500,
      message: error.message || 'Failed to post message',
    })
  }
})
