<template>
  <ClientOnly>
    <UApp>
      <NuxtLayout>
	      <div v-if="isDev" class="font-['Bebas_Neue'] fixed top-4 left-[-45px] bg-red-700 outline-2 text-white text-md font-bold uppercase tracking-wider rotate-[-45deg] w-48 text-center shadow-lg translate-y-4">
		      <UButton to="https://git.ppo.gg/MYND/unfit-for-print" target="_blank" icon="i-logos-gitlab" variant="link" color="warning" >Dev Preview</UButton>
	      </div>
          <NuxtPage />
      </NuxtLayout>
    </UApp>
  </ClientOnly>
</template>
<script setup lang="ts">
const isDev = import.meta.env.DEV;

</script>
