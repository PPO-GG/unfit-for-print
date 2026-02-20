import { useUserStore } from '~/stores/userStore'
import { useNotifications } from '~/composables/useNotifications'
import { useAdminCheck } from '~/composables/useAdminCheck'

export default defineNuxtRouteMiddleware(async (to) => {
// '[middleware/admin] Middleware called for route:', to.path)

    if (import.meta.server) {
// '[middleware/admin] Running on server, skipping')
        return
    }

// '[middleware/admin] Running on client')
    const userStore = useUserStore()
// '[middleware/admin] User exists:', !!userStore.user)
// '[middleware/admin] Session exists:', !!userStore.session)

    if (!userStore.user) {
// '[middleware/admin] No user, fetching session')
        await userStore.fetchUserSession()
// '[middleware/admin] Session fetch complete, user exists:', !!userStore.user)
    }

// '[middleware/admin] Checking if user is admin')
    const isAdmin = await useAdminCheck()
// '[middleware/admin] Is admin:', isAdmin)

    if (!isAdmin) {
// '[middleware/admin] Not admin, redirecting to home')
        useNotifications().notify({
            title: 'Access Denied',
            description: 'You do not have permission to access this page.',
            color: 'error'
        })
        return navigateTo('/')
    }

// '[middleware/admin] Admin check passed, allowing access to:', to.path)
})
