// composables/useAdminCheck.ts
import { getAppwrite } from '~/utils/appwrite'
import { useUserStore } from '~/stores/userStore'

/**
 * Checks if the current user is an admin by verifying team membership.
 * Safe for anonymous users — will return false.
 */
export const useAdminCheck = async (): Promise<boolean> => {
    const userStore = useUserStore()
    const userId = userStore.user?.$id

    if (!userId) return false // not logged in = not admin

    try {
        const { teams } = getAppwrite()
        const config = useRuntimeConfig()
        const ADMIN_TEAM_ID = config.public.appwriteAdminTeamId as string

        const memberships = await teams.listMemberships(ADMIN_TEAM_ID)
        return memberships.memberships.some(
            (m) => m.userId === userId && m.confirm
        )
    } catch (err) {
        console.error('[useAdminCheck] error:', err)
        return false
    }
}

/**
 * Returns a reactive ref for admin state — for use in templates
 */
export const useIsAdmin = () => {
    const isAdmin = ref(false)

    onMounted(async () => {
        isAdmin.value = await useAdminCheck()
    })

    return isAdmin
}
