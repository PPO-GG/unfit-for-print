// server/api/admin/users/index.ts
import {createAppwriteClient} from '~/server/utils/appwrite'

export default defineEventHandler(async (event) => {
    const { users } = createAppwriteClient()
    return await users.list()
})
