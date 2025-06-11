import { defineNuxtPlugin } from '#app'
import gsap from 'gsap'
import Flip from 'gsap/Flip'
import ScrollTrigger from 'gsap/ScrollTrigger'

export default defineNuxtPlugin((nuxtApp) => {
    if (import.meta.client) {
        gsap.registerPlugin(ScrollTrigger, Flip)
    }

    return {
        provide: {
            gsap,
            ScrollTrigger,
            Flip
        },
    }
})