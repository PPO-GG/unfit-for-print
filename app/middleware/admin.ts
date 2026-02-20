import { useUserStore } from '~/stores/userStore'
import { useNotifications } from '~/composables/useNotifications'
import { useAdminCheck } from '~/composables/useAdminCheck'

export default defineNuxtRouteMiddleware(async (to) => {
    console.log('[middleware/admin] Middleware called for route:', to.path)

    if (import.meta.server) {
        console.log('[middleware/admin] Running on server, skipping')
        return
    }

    console.log('[middleware/admin] Running on client')
    const userStore = useUserStore()
    console.log('[middleware/admin] User exists:', !!userStore.user)
    console.log('[middleware/admin] Session exists:', !!userStore.session)

    if (!userStore.user) {
        console.log('[middleware/admin] No user, fetching session')
        await userStore.fetchUserSession()
        console.log('[middleware/admin] Session fetch complete, user exists:', !!userStore.user)
    }

    console.log('[middleware/admin] Checking if user is admin')
    const isAdmin = await useAdminCheck()
    console.log('[middleware/admin] Is admin:', isAdmin)

    if (!isAdmin) {
        console.log('[middleware/admin] Not admin, redirecting to home')
        useNotifications().notify({
            title: 'Access Denied',
            description: 'You do not have permission to access this page.',
            color: 'error'
        })
        return navigateTo('/')
    }

    console.log('[middleware/admin] Admin check passed, allowing access to:', to.path)
})
