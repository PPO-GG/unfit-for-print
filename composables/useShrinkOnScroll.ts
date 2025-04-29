// composables/useShrinkOnScroll.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useShrinkOnScroll(threshold = 50) {
    const isShrunk = ref(false)

    function onScroll() {
        isShrunk.value = window.scrollY > threshold
    }

    onMounted(() => {
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll() // initialize
    })

    onUnmounted(() => {
        window.removeEventListener('scroll', onScroll)
    })

    return { isShrunk }
}
