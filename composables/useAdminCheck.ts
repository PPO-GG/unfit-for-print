// composables/useAdminCheck.ts
import {getAppwrite} from '~/utils/appwrite'
import {useUserStore} from '~/stores/userStore'

/**
 * Checks if the current user is an admin by verifying team membership.
 * Safe for anonymous users — will return false.
 */
export const useAdminCheck = async (): Promise<boolean> => {
    // console.log('[useAdminCheck] Checking if user is admin')
    const userStore = useUserStore()
    const userId = userStore.user?.$id

    // console.log('[useAdminCheck] User ID:', userId)
    // console.log('[useAdminCheck] Session exists:', !!userStore.session)

    if (!userId) {
        // console.log('[useAdminCheck] No user ID, returning false')
        return false // not logged in = not admin
    }

    try {
        // console.log('[useAdminCheck] Getting Appwrite teams service')
        const { teams } = getAppwrite()
        const config = useRuntimeConfig()
        const ADMIN_TEAM_ID = config.public.appwriteAdminTeamId as string
        // console.log('[useAdminCheck] Admin team ID:', ADMIN_TEAM_ID)

        // console.log('[useAdminCheck] Listing team memberships')
        const memberships = await teams.listMemberships(ADMIN_TEAM_ID)
        // console.log('[useAdminCheck] Team memberships:', memberships.memberships)
        // console.log('[useAdminCheck] Is admin:', isAdmin)

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
