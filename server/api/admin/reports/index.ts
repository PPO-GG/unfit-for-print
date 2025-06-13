// server/api/admin/reports/index.ts
import { createAppwriteClient } from '~/server/utils/appwrite'
import { assertAdmin } from '~/server/utils/adminOnly'
import { Query } from 'appwrite'

export default defineEventHandler(async (event) => {
    await assertAdmin(event)

    const config = useRuntimeConfig()
    const { databases } = createAppwriteClient()
    
    // Fetch reports from the reports collection
    const result = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        config.public.appwriteReportsCollectionId,
        [
            Query.orderDesc('$createdAt')
        ]
    )

    return { reports: result.documents }
})