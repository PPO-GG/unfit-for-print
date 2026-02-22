<script lang="ts" setup>
defineProps({
  code: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <div
    class="w-full h-full flex justify-center items-center text-white"
    style="
      background: linear-gradient(135deg, #0f0f0f, #1f1f1f);
      font-family: Inter, sans-serif;
    "
  >
    <div
      class="flex flex-col items-center bg-[#111111] border-2 border-[#444444] rounded-[20px] px-[60px] py-[40px] shadow-2xl"
    >
      <img
        src="https://ufp.ppo.gg/img/unfit_logo_alt.png"
        width="320"
        height="320"
        alt="Logo"
        class="rounded-[12px] mb-5"
      />
      <p class="text-[32px] mt-2 text-[#bbbbbb]">Join Game Code: {{ code }}</p>
    </div>
  </div>
</template>
