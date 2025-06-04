<script lang="ts" setup>
defineProps({
  blackCard: {
    type: Object,
    default: null
  },
  flipped: {
    type: Boolean,
    default: true
  }
})
</script>

<template>
  <div class="relative w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72 aspect-[3/4] outline-2 outline-slate-400/25 outline-offset-16 outline-dashed rounded-xl">
    <!-- Stack effect with multiple cards -->
    <div v-for="i in 5" :key="`black-stack-${i}`"
         :style="{
           position: 'absolute',
           top: `${i * 2}px`,
           left: `${i * 2}px`,
           zIndex: 5 - i
         }"
         class="w-full h-full -translate-x-2 -translate-y-2">
      <BlackCard
          :flipped="true"
          :shine="false"
          :three-deffect="false"
      />
    </div>
    <!-- Top card (current black card) -->
    <div v-if="blackCard"
         class="absolute top-0 left-0 z-10 w-full h-full transform hover:translate-y-[-20px] hover:scale-105 -translate-x-2 -translate-y-2 transition-transform duration-300">
      <BlackCard
          v-if="blackCard"
          :card-id="blackCard.id"
          :flipped="false"
          :num-pick="blackCard.pick"
          :text="blackCard.text"
          :three-deffect="true"
      />
    </div>
  </div>
</template>