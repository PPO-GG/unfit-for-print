<script setup lang="ts">
withDefaults(
		defineProps<{
			title?: string
			subtitle?: string
			logo?: string
			textColor?: string
			bgGradient?: string
			logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
		}>(),
		{
			title: 'Unfit for Print',
			subtitle: '',
			logo: '',
			bgGradient: '',
			textColor: '#000000',
			logoPosition: 'top-left',
		}
)
</script>

<template>
	<div
			class="h-full w-full flex flex-col justify-between p-20 relative"
			:style="{
      background: bgGradient || `linear-gradient(to right, #111827, #1f2937)`,
    }"
	>
		<!-- Logo -->
		<img
				v-if="logo"
				:src="logo"
				class="w-64 absolute"
				alt="Site Logo"
				:class="{
        'top-10 left-10': logoPosition === 'top-left',
        'top-10 right-10': logoPosition === 'top-right',
        'bottom-10 left-10': logoPosition === 'bottom-left',
        'bottom-10 right-10': logoPosition === 'bottom-right',
      }"
		/>

		<!-- Main content -->
		<div class="flex flex-col h-full justify-center">
			<h1
					class="text-[80px] font-extrabold leading-tight drop-shadow-xl"
					:style="{ color: textColor }"
			>
				{{ title }}
			</h1>
			<p
					v-if="subtitle"
					class="text-[36px] font-semibold mt-4"
					:style="{ color: textColor }"
			>
				{{ subtitle }}
			</p>
		</div>

		<!-- Footer domain -->
		<p class="text-[28px] font-bold" :style="{ color: textColor }">
			unfit.cards
		</p>
	</div>
</template>
