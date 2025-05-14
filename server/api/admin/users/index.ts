// server/api/admin/users/index.ts
import { createAppwriteClient } from '~/server/utils/appwrite'
import { assertAdmin } from '~/server/utils/adminOnly'

export default defineEventHandler(async (event) => {
    await assertAdmin(event)

    const { users } = createAppwriteClient()
    const result = await users.list()

    return { users: result.users }
})