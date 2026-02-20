<!-- ShareImage.vue -->
<script setup lang="ts">
import * as domToImage from 'dom-to-image-more'
import { ref, nextTick } from 'vue'
import BlackCard from '~/components/game/BlackCard.vue'
import WhiteCard from '~/components/game/WhiteCard.vue'

const props = defineProps<{
  blackCard?: { id?: string; text: string; pick?: number }
  whiteCardIds: string[]
}>()

const captureRef = ref<HTMLElement | null>(null)
const PIX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

async function settle() {
  await nextTick()
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

async function fileToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

async function fetchAsDataUrl(url: string) {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    return await fileToDataUrl(blob)
  } catch {
    return PIX
  }
}

/** Inline <img src>, return restore function */
async function inlineImgs(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
  const originals: Array<[HTMLImageElement, string]> = []
  await Promise.all(imgs.map(async img => {
    const src = img.getAttribute('src') || ''
    if (!src || src.startsWith('data:')) return
    originals.push([img, src])
    const dataUrl = await fetchAsDataUrl(src)
    img.setAttribute('src', dataUrl)
    // Stabilize layout
    if (!img.width && img.naturalWidth) img.width = img.naturalWidth
    if (!img.height && img.naturalHeight) img.height = img.naturalHeight
  }))
  return () => originals.forEach(([el, src]) => el.setAttribute('src', src))
}

/** Inline CSS background-image URLs into style attr */
async function inlineBackgrounds(root: HTMLElement) {
  const all = Array.from(root.querySelectorAll('*')) as HTMLElement[]
  const originals: Array<[HTMLElement, string | null]> = []
  await Promise.all(all.map(async el => {
    const cs = getComputedStyle(el)
    const bg = cs.backgroundImage
    if (!bg || bg === 'none' || bg.startsWith('data:')) return
    // supports single-url backgrounds; extend if you use multiple
    const m = bg.match(/url\(["']?([^"')]+)["']?\)/)
    if (!m) return
    const url = m[1]
    originals.push([el, el.style.backgroundImage || null])
    const dataUrl = await fetchAsDataUrl(url)
    el.style.backgroundImage = `url("${dataUrl}")`
  }))
  return () => originals.forEach(([el, prev]) => {
    if (prev === null) el.style.removeProperty('background-image')
    else el.style.backgroundImage = prev
  })
}

async function download() {
  const el = captureRef.value
  if (!el) return
  await settle()

  // Inline external assets to avoid tainted canvas / fetch errors
  const restoreImgs = await inlineImgs(el)
  const restoreBgs = await inlineBackgrounds(el)

  try {
    const dataUrl = await domToImage.toPng(el, {
      cacheBust: true,
      bgcolor: '#0f172a',
      imagePlaceholder: PIX,
      fetchRequestInit: { mode: 'cors', credentials: 'omit' },
      // Important: keep it simple for cross-browser reliability
      style: {
        // Use system stack to avoid font inlining/fetch
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
        color: '#fff'
      },
      // strip out anything risky
      filter: (node) => {
        if (node.nodeType !== 1) return false
        const tag = (node as HTMLElement).tagName
        return tag !== 'SCRIPT' && tag !== 'STYLE'
      }
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'unfit.png'
    a.click()
  } catch (e) {
    console.error('capture failed', e)
  } finally {
    restoreImgs()
    restoreBgs()
  }
}
</script>

<template>
  <div>
    <div class="fixed -left-[9999px] -top-[9999px]">
      <div
          ref="captureRef"
          class="p-4 flex gap-4 bg-slate-800"
          style="
          width:1024px; max-width:1024px; border-radius:12px;
          /* Disable effects that often break rasterizers */
          transform:none !important; animation:none !important; transition:none !important;
        "
      >
        <BlackCard
            v-if="blackCard"
            :card-id="blackCard.id"
            :text="blackCard.text"
            :num-pick="blackCard.pick"
            :threeDeffect="false"
            :shine="false"
        />
        <div class="flex flex-wrap gap-2 items-start">
          <WhiteCard
              v-for="id in whiteCardIds"
              :key="id"
              :card-id="id"
              :is-winner="true"
              :flipped="false"
              :three-deffect="false"
              :shine="false"
              :disable-hover="true"
          />
        </div>
      </div>
    </div>

    <UButton
        @click="download"
        color="primary"
        class="text-xl py-2 px-4 cursor-pointer font-['Bebas_Neue']"
        icon="i-solar-square-share-line-bold-duotone"
        variant="subtle"
    />
  </div>
</template>
