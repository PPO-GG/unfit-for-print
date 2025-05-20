export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()

  console.log('Deleting RocketChat room with name:', body.roomName)

  try {
    const response = await $fetch('https://chat.ppo.gg/api/v1/groups.delete', {
      method: 'POST',
      headers: {
        'X-Auth-Token': config.rocketchatBotToken,
        'X-User-Id': config.rocketchatBotUserId,
        'Content-Type': 'application/json',
      },
      body: {
        roomName: body.roomName,
      },
    })

    console.log('RocketChat room deletion successful:', response)
    return response
  } catch (error) {
    console.error('Error deleting RocketChat room:', error)

    // Return a structured error response
    throw createError({
      statusCode: error.response?.status || 500,
      message: error.message || 'Failed to delete room',
    })
  }
})