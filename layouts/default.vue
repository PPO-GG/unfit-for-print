<template>
	<div class="relative min-h-screen subpixel-antialiased cursor-default">
		<!-- Background behind everything -->
		<ScrollingBackground
				:gap="12"
				:scale="0.5"
				:speedPx="15"
		/>

		<!-- Foreground: Header -> Main Content -> Footer -->
		<div class="flex flex-col min-h-screen">
			<div ref="headerRef">
				<AppHeader/>
			</div>

			<main
					:style="{
          marginTop: `${headerSize.height}px`,
          marginBottom: `${footerSize.height}px`
        }"
					class="flex-1 p-4 mt-8"
			>
				<slot/>
			</main>
			<div ref="footerRef">
			<AppFooter/>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {ref} from 'vue'
import {useElementSize} from '@vueuse/core'

const headerRef = ref(null)
const headerSize = useElementSize(headerRef)

const footerRef = ref(null)
const footerSize = useElementSize(footerRef)
</script>
