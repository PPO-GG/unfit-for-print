import { defineEventHandler, getRouterParam } from 'h3'
import { Client, Databases, Query } from 'node-appwrite'

export default defineEventHandler(async (event) => {
    const code = getRouterParam(event, 'code')?.toUpperCase()

    if (!code) {
        return { error: 'Missing lobby code' }
    }

    const client = new Client()
        .setEndpoint('https://console.ppo.gg/v1') // No NUXT_PUBLIC_ here
        .setProject('682eb1b9000cb3845772'!)
        .setKey(process.env.APPWRITE_API_KEY!) // NEVER expose this to client!

    const databases = new Databases(client)
    const config = useRuntimeConfig()

    const dbId = config.appwriteDbId
    const collectionId = config.appwriteLobbyCollectionId

    const res = await databases.listDocuments(dbId, collectionId, [
        Query.equal('code', code)
    ])

    if (!res.total) {
        return { error: 'Lobby not found' }
    }

    const lobby = res.documents[0]

    // Only return safe data to the frontend
    return {
        name: lobby.name,
        code: lobby.code,
        hostUserId: lobby.hostUserId,
        isPrivate: lobby.isPrivate,
        currentPlayers: lobby.currentPlayers,
        // Add more fields as needed — but filter sensitive stuff
    }
})
