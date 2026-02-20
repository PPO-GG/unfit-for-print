<script setup lang="ts">
import { toPng } from "html-to-image";
import BlackCard from "~/components/game/BlackCard.vue";
import WhiteCard from "~/components/game/WhiteCard.vue";
import { ref } from "vue";

const props = defineProps<{
  blackCard?: { id?: string; text: string; pick?: number };
  whiteCardIds: string[];
}>();

const captureRef = ref<HTMLElement | null>(null);

async function download() {
  if (!captureRef.value) return;
  try {
    const dataUrl = await toPng(captureRef.value, {
      pixelRatio: 2,
      fontEmbedCSS: "",
      filter: (node: Node) => {
        // Skip card back faces — they contain images with undefined src
        // and are invisible anyway (backface-visibility: hidden)
        if (
          node instanceof HTMLElement &&
          node.classList.contains("card__back")
        ) {
          return false;
        }
        return true;
      },
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "unfit.png";
    link.click();
  } catch (e) {
    console.error("Failed to generate image", e);
  }
}
</script>

<template>
  <div>
    <div class="fixed -left-[9999px] -top-[9999px]">
      <div ref="captureRef" class="p-4 flex gap-4 bg-slate-800">
        <BlackCard
          v-if="blackCard"
          :card-id="blackCard.id"
          :text="blackCard.text"
          :num-pick="blackCard.pick"
        />
        <div class="flex flex-wrap gap-2">
          <WhiteCard
            v-for="id in whiteCardIds"
            :key="id"
            :card-id="id"
            :is-winner="true"
            :flipped="false"
          />
        </div>
      </div>
    </div>
    <UButton @click="download" color="primary" variant="subtle">
      <slot>Share</slot>
    </UButton>
  </div>
</template>
