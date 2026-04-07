<template>
  <div class="min-h-screen relative subpixel-antialiased cursor-default">
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />
    <AtmosphericOverlay vignette />
    <main class="relative z-10 min-h-screen flex flex-col">
      <slot />
    </main>
  </div>
</template>
