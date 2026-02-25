import { defineNuxtPlugin } from "#app";
import gsap from "gsap";
import Flip from "gsap/Flip";
import ScrollTrigger from "gsap/ScrollTrigger";
import TextPlugin from "gsap/TextPlugin";

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.client) {
    gsap.registerPlugin(ScrollTrigger, Flip, TextPlugin);
  }

  return {
    provide: {
      gsap,
      ScrollTrigger,
      Flip,
      TextPlugin,
    },
  };
});
