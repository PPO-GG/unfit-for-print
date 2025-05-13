// server/api/admin/teams/update.ts
import { createAppwriteClient } from '~/server/utils/appwrite'
import { assertAdmin } from '~/server/utils/adminOnly'

export default defineEventHandler(async (event) => {
    // Check if the user is an admin before proceeding
    await assertAdmin(event)

    const { action, teamId, userId, membershipId } = await readBody(event)
    const { teams } = createAppwriteClient()

    if (action === 'remove') {
        return await teams.deleteMembership(teamId, membershipId)
    }

    if (action === 'add') {
        return await teams.createMembership(
            teamId,
            ['admin'],
            undefined,
            userId,
            undefined,
            'https://unfit.cards/auth/callback',
            undefined
        )
    }

    return { error: 'Invalid action' }
})
