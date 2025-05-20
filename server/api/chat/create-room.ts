export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()

  console.log('Creating RocketChat room with name:', body.name)

  try {
    const response = await $fetch('https://chat.ppo.gg/api/v1/groups.create', {
      method: 'POST',
      headers: {
        'X-Auth-Token': config.rocketchatBotToken,
        'X-User-Id': config.rocketchatBotUserId,
        'Content-Type': 'application/json',
      },
      body: {
        name: body.name,
      },
    })

    return response
  } catch (error) {
    console.error('Error creating RocketChat room:', error)

    // Check if the error is because the room already exists
    if (error.response?.status === 400 && 
        error.response?.data?.error?.includes('name-already-exists')) {

      console.log('Room already exists, trying to get room info instead')

      // If the room already exists, try to get its info
      try {
        const roomInfo = await $fetch('https://chat.ppo.gg/api/v1/groups.info', {
          method: 'GET',
          headers: {
            'X-Auth-Token': config.rocketchatBotToken,
            'X-User-Id': config.rocketchatBotUserId,
          },
          params: {
            roomName: body.name,
          },
        })

        return roomInfo
      } catch (infoError) {
        console.error('Failed to get info for existing room:', infoError)
        throw createError({
          statusCode: 500,
          message: 'Failed to get info for existing room',
        })
      }
    }

    // For other errors, return a structured error response
    throw createError({
      statusCode: error.response?.status || 500,
      message: error.message || 'Failed to create room',
    })
  }
})
