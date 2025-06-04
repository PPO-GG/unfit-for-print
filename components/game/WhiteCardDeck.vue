<script lang="ts" setup>
defineProps({
  backLogoUrl: {
    type: String,
    default: '/img/ufp.svg'
  },
  maskUrl: {
    type: String,
    default: '/img/textures/hexa.png'
  }
})
</script>

<template>
  <div class="relative w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72 aspect-[3/4] outline-2 outline-slate-400/25 outline-offset-16 outline-dashed rounded-xl">
    <!-- Stack effect with multiple cards -->
    <div v-for="i in 5" :key="`white-stack-${i}`"
         :style="{
           position: 'absolute',
           top: `${i * 2}px`,
           left: `${i * 2}px`,
           zIndex: 5 - i
         }"
         class="w-full h-full -translate-x-2 -translate-y-2">
      <whiteCard
          :backLogoUrl="backLogoUrl"
          :flipped="true"
          :mask-url="maskUrl"
          :shine="false"
          :threeDeffect="false"
      />
    </div>
  </div>
</template>