import { type Ref, nextTick, onMounted, onUnmounted, watch } from 'vue'

export function useFitText(
  containerRef: Ref<HTMLElement | null>,
  textRef: Ref<HTMLElement | null>,
  source: Ref<string>,
  { maxPx = 38, minPx = 11, step = 0.5 } = {},
) {
  let observer: ResizeObserver | null = null

  function fit() {
    const container = containerRef.value
    const el = textRef.value
    if (!container || !el) return

    let size = maxPx
    el.style.fontSize = `${size}px`

    while (size > minPx && (el.scrollHeight > container.clientHeight || el.scrollWidth > container.clientWidth)) {
      size -= step
      el.style.fontSize = `${size}px`
    }
  }

  onMounted(() => {
    observer = new ResizeObserver(() => nextTick(fit))
    if (containerRef.value) observer.observe(containerRef.value)
    nextTick(fit)
  })

  onUnmounted(() => observer?.disconnect())

  watch(source, () => nextTick(fit))
}
