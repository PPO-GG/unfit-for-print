<template>
  <ClientOnly>
    <UApp>
      <AppHeader />
      <main>
        <slot />
      </main>
    </UApp>
  </ClientOnly>
</template>