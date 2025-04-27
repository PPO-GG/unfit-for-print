<template>
  <ClientOnly>
    <UApp>
      <NuxtLayout>
	      <div v-if="isDev" class="absolute top-6 left-[-40px] bg-red-600 text-white text-xs font-bold uppercase tracking-wider rotate-[-45deg] w-48 py-2 text-center shadow-lg">
		      Dev Preview
	      </div>
          <NuxtPage />
      </NuxtLayout>
    </UApp>
  </ClientOnly>
</template>
<script setup lang="ts">
const isDev = import.meta.env.DEV;

</script>