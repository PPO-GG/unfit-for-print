import { useUserStore } from '~/stores/userStore'
import { createAppwriteClient } from '~/server/utils/appwrite'
import { isAuthenticatedSession } from '~/composables/useUserUtils'

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    const cookies: Record<string, string> = {}
    if (!cookieHeader) return cookies
    for (const part of cookieHeader.split(';')) {
        const [name, ...rest] = part.split('=')
        if (!name) continue
        cookies[name.trim()] = decodeURIComponent(rest.join('=')).trim()
    }
    return cookies
}

export default defineNuxtPlugin(async () => {
    if (!process.server) return

    const userStore = useUserStore()
    const headers = useRequestHeaders(['cookie'])
    const cookies = parseCookies(headers.cookie)

    // Appwrite session cookie typically starts with a_session_<projectId>
    const sessionKey = Object.keys(cookies).find((key) => key.startsWith('a_session_'))
    if (!sessionKey) return

    const sessionId = cookies[sessionKey]
    try {
        const { client, account, teams } = createAppwriteClient()
        client.setSession(sessionId)

        const config = useRuntimeConfig()
        const ADMIN_TEAM_ID = config.public.appwriteAdminTeamId

        const [session, rawUser, memberships] = await Promise.all([
            account.getSession('current'),
            account.get(),
            ADMIN_TEAM_ID ? teams.listMemberships(ADMIN_TEAM_ID) : Promise.resolve(null)
        ])

        const isAdmin = Boolean(
            ADMIN_TEAM_ID &&
            memberships &&
            memberships.memberships.some((m) => m.userId === rawUser.$id && m.confirm)
        )

        const user = {
            ...JSON.parse(JSON.stringify(rawUser)),
            provider: session.provider,
            teams: isAdmin ? [ADMIN_TEAM_ID] : []
        }

        userStore.$patch({
            user,
            session: JSON.parse(JSON.stringify(session)),
            accessToken: session.providerAccessToken ?? null,
            isLoggedIn: isAuthenticatedSession(session)
        })
    } catch (err) {
        console.error('[init-session.server] Failed to initialize user session:', err)
    }
})