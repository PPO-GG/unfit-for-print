<template>
  <!-- dvh, not vh: on phones 100vh is the toolbar-hidden height, so the page
       came out taller than the screen and left blank space under the game. -->
  <main class="min-h-dvh">
    <slot />
  </main>
</template>