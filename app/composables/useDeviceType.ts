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

    const isSizeMobile = computed(() => breakpoints.smaller('tablet').value)
    const isSizeTablet = computed(() => breakpoints.between('tablet', 'desktop').value)
    const isSizeDesktop = computed(() => breakpoints.greater('tablet').value)

    const deviceType = computed<'Mobile' | 'Tablet' | 'Desktop' | 'Unknown'>(() => {

        if (isSizeMobile.value) return 'Mobile'

        if (isSizeTablet.value) {
            return isTouchDevice.value ? 'Tablet' : 'Desktop'
        }

        if (isSizeDesktop.value) {
            return isTouchDevice.value ? 'Tablet' : 'Desktop'
        }

        return 'Unknown'
    })

    return {
        deviceType,
        isSizeMobile,
        isSizeTablet,
        isSizeDesktop,
        isTouchDevice,
    }
}
