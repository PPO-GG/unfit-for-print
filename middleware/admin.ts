import { useUserStore } from '~/stores/userStore'
import { useNotifications } from '~/composables/useNotifications'
import { useAdminCheck } from '~/composables/useAdminCheck'

export default defineNuxtRouteMiddleware(async () => {
    if (import.meta.server) return

    const userStore = useUserStore()

    if (!userStore.user) {
        await userStore.fetchUserSession()
    }

    const isAdmin = await useAdminCheck()

    if (!isAdmin) {
        useNotifications().notify({
            title: 'Access Denied',
            description: 'You do not have permission to access this page.',
            color: 'error'
        })
        return navigateTo('/')
    }
})