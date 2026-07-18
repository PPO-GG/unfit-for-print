<!--
  Animated beaker decoration for the Labs hero. Positioned absolutely
  on the right side of the hero card, with gently rising bubbles.
-->
<template>
  <svg
    class="lab-beaker"
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="labs-beaker-liquid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="oklch(78% 0.20 140)" stop-opacity="0.4" />
        <stop offset="100%" stop-color="oklch(80% 0.20 140)" stop-opacity="0.85" />
      </linearGradient>
    </defs>
    <!-- beaker outline -->
    <path
      d="M35 12 L35 38 L20 80 Q20 88 28 88 L72 88 Q80 88 80 80 L65 38 L65 12"
      stroke="oklch(80% 0.20 140)"
      stroke-width="2"
      fill="none"
    />
    <path
      d="M30 12 L70 12"
      stroke="oklch(80% 0.20 140)"
      stroke-width="2.5"
      stroke-linecap="round"
    />
    <!-- liquid -->
    <path
      d="M27 50 L20 80 Q20 88 28 88 L72 88 Q80 88 80 80 L73 50 Z"
      fill="url(#labs-beaker-liquid)"
    />
    <!-- bubbles -->
    <circle cx="40" cy="70" r="2" fill="oklch(85% 0.18 140)" opacity="0.8">
      <animate attributeName="cy" values="80;55;55" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.8;0" dur="2s" repeatCount="indefinite" />
    </circle>
    <circle cx="55" cy="75" r="1.5" fill="oklch(85% 0.18 140)" opacity="0.8">
      <animate attributeName="cy" values="80;55;55" dur="2.5s" begin="0.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.8;0" dur="2.5s" begin="0.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="48" cy="72" r="1" fill="oklch(85% 0.18 140)" opacity="0.8">
      <animate attributeName="cy" values="80;55;55" dur="1.8s" begin="1s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.8;0" dur="1.8s" begin="1s" repeatCount="indefinite" />
    </circle>
  </svg>
</template>
