import { defineNuxtPlugin, useRuntimeConfig, useRoute } from '#app'
import { useScriptRybbitAnalytics } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
    const { proxy } = useScriptRybbitAnalytics()
    const route = useRoute()
    const config = useRuntimeConfig()

    const getContext = () => {
        const userStore = useUserStore()
        return {
            route: route.name ?? route.path,
            userId: userStore.user?.$id ?? undefined,
        }
    }

    const trackEvent = (name: string, props: Record<string, any> = {}) => {
        if (import.meta.client) {
            proxy.event(name, { ...getContext(), ...props })
        }
    }

    const trackPageview = () => {
        if (import.meta.client) proxy.pageview()
    }

    const setUserId = (id: string) => {
        if (import.meta.client) proxy.identify(id)
    }

    const clearUserId = () => {
        if (import.meta.client) proxy.clearUserId()
    }

    const analytics = {
        trackEvent,
        trackPageview,
        setUserId,
        clearUserId
    }

    // Inject as $analytics
    nuxtApp.provide('analytics', analytics)
})
