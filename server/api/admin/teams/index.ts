// server/api/admin/teams/index.ts
import {createAppwriteClient} from '~/server/utils/appwrite'

export default defineEventHandler(async () => {
    const { teams } = createAppwriteClient()
    return await teams.list()
})
