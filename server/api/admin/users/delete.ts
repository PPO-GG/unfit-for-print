// server/api/admin/users/delete.ts
import { createAppwriteClient } from '~/server/utils/appwrite'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const userId = body.userId

    if (!userId) {
        return { success: false, message: 'Missing userId' }
    }

    const { users } = createAppwriteClient()

    try {
        await users.delete(userId)
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
})
