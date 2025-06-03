export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    './content/**/*.md',
    "./assets/css/**/*.css",
  ],
  theme: {
    extend: {
      cursor: {
        default: 'url("/img/cursor/default.cur"), default',
        pointer: 'url("/img/cursor/pointer.cur"), pointer',
      },
    },
  },
  plugins: []
}
