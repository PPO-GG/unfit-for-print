export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig()

  try {
    const response = await $fetch('https://chat.ppo.gg/api/v1/groups.info', {
      method: 'GET',
      headers: {
        'X-Auth-Token': config.rocketchatBotToken,
        'X-User-Id': config.rocketchatBotUserId,
      },
      params: {
        roomName: query.roomName,
      },
    })

    return response
  } catch (error) {
    console.error('Error in room-info.ts:', error)

    // If the room doesn't exist, return a structured response
    // so the client knows to create it
    return { success: false, error: 'Room not found' }
  }
})
