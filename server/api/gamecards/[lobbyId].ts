import { defineEventHandler, getRouterParam } from 'h3'
import { Client, Databases, Query } from 'node-appwrite'

export default defineEventHandler(async (event) => {
    const lobbyId = getRouterParam(event, 'lobbyId')

    if (!lobbyId) {
        return { error: 'Missing lobby ID' }
    }

    const config = useRuntimeConfig()
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://console.ppo.gg/v1')
        .setProject(process.env.APPWRITE_PROJECT_ID || '682eb1b9000cb3845772')
        .setKey(process.env.APPWRITE_API_KEY!)

    const databases = new Databases(client)

    const dbId = process.env.APPWRITE_DB_ID || config.appwriteDbId
    const collectionId = process.env.NUXT_PUBLIC_APPWRITE_GAMECARDS_COLLECTION_ID || config.public.appwriteGamecardsCollectionId

    // Validate database ID
    if (!dbId || dbId.length > 36 || !/^[a-zA-Z0-9_]+$/.test(dbId) || dbId.startsWith('_')) {
        console.error('Invalid database ID:', dbId)
        return { error: 'Invalid database ID configuration' }
    }

    // Validate collection ID
    if (!collectionId || collectionId.length > 36 || !/^[a-zA-Z0-9_]+$/.test(collectionId) || collectionId.startsWith('_')) {
        console.error('Invalid gamecards collection ID:', collectionId)
        return { error: 'Invalid collection ID configuration' }
    }

    try {
        const res = await databases.listDocuments(dbId, collectionId, [
            Query.equal('lobbyId', lobbyId)
        ])

        if (!res.total) {
            return { error: 'Game cards not found for this lobby' }
        }

        // Return the game cards data
        return res.documents[0]
    } catch (err) {
        console.error('Failed to fetch game cards:', err)
        return { error: 'Failed to fetch game cards', details: err instanceof Error ? err.message : String(err) }
    }
})
