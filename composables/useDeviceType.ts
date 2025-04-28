import { useBreakpoints } from '@vueuse/core'

export function useDeviceType() {
    const breakpoints = useBreakpoints({
        mobile: 0, // optional
        tablet: 640,
        laptop: 1024,
        desktop: 1280,
    })

    const isTouchDevice = ref(false)

    onMounted(() => {
        isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    })

    const isMobile = computed(() => breakpoints.smaller('tablet').value)
    const isTablet = computed(() => breakpoints.between('tablet', 'desktop').value)
    const isDesktop = computed(() => breakpoints.greater('tablet').value)

    const deviceType = computed<'Mobile' | 'Tablet' | 'Desktop' | 'Unknown'>(() => {

        if (isMobile.value) return 'Mobile'

        if (isTablet.value) {
            return isTouchDevice.value ? 'Tablet' : 'Desktop'
        }

        if (isDesktop.value) {
            return isTouchDevice.value ? 'Tablet' : 'Desktop'
        }

        return 'Unknown'
    })

    return {
        deviceType,
        isMobile,
        isTablet,
        isDesktop,
        isTouchDevice,
    }
}
