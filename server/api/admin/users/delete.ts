import { createAppwriteClient } from '~/server/utils/appwrite'
import { assertAdmin } from '~/server/utils/adminOnly'
import { readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
    await assertAdmin(event)

    const body = await readBody<{ userId?: string }>(event)
    const userId = body.userId

    if (!userId) {
        throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
    }

    const { users } = createAppwriteClient()

    try {
        await users.delete(userId)
        return { success: true }
    } catch (err: any) {
        console.error('[admin/users/delete] Failed to delete user:', err)
        throw createError({ statusCode: 500, statusMessage: 'Failed to delete user' })
    }
})