<script lang="ts" setup>
defineProps({
  blackCard: {
    type: Object,
    default: null,
  },
  flipped: {
    type: Boolean,
    default: true,
  },
});
</script>

<template>
  <div
    class="relative w-32 md:w-48 lg:w-56 aspect-[3/4] outline-2 outline-slate-400/25 md:outline-offset-6 outline-offset-2 outline-dashed rounded-xl"
  >
    <!-- Stack effect with multiple cards -->
    <div
      v-for="i in 5"
      :key="`black-stack-${i}`"
      :style="{
        position: 'absolute',
        top: `${i * 2}px`,
        left: `${i * 2}px`,
        zIndex: 5 - i,
      }"
      class="w-full h-full -translate-x-3 -translate-y-3"
    >
      <BlackCard :flipped="true" :shine="false" :three-deffect="false" />
    </div>
    <!-- Top card (current black card) -->
    <div
      v-if="blackCard"
      class="absolute top-0 left-0 z-10 w-full h-full -translate-x-3 -translate-y-3 transform hover:translate-y-[-20px] hover:scale-105 transition-transform duration-300"
    >
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
