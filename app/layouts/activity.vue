<template>
  <div class="relative min-h-screen subpixel-antialiased cursor-default">
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />
    <main class="relative flex-1 p-4">
      <slot />
    </main>
  </div>
</template>
