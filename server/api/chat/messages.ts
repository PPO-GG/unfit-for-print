export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig()

  try {
    const response = await $fetch('https://chat.ppo.gg/api/v1/groups.messages', {
      method: 'GET',
      headers: {
        'X-Auth-Token': config.rocketchatBotToken,
        'X-User-Id': config.rocketchatBotUserId,
      },
      params: {
        roomId: query.roomId,
      },
    })

    return response
  } catch (error) {
    console.error('Error fetching messages:', error)

    // Return a structured error response
    throw createError({
      statusCode: error.response?.status || 500,
      message: error.message || 'Failed to fetch messages',
    })
  }
})
