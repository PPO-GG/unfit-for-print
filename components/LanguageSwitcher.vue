<script setup lang="ts">

const { locale, locales, setLocale, setLocaleCookie } = useI18n()
const userPrefsStore = useUserPrefsStore()

const flagIcons = {
	en: 'i-flag-gb-1x1',
	es: 'i-flag-es-1x1',
	fr: 'i-flag-fr-1x1',
	ru: 'i-flag-ru-1x1',
	de: 'i-flag-de-1x1',
	ja: 'i-flag-jp-1x1',
	ko: 'i-flag-kr-1x1',
	pt: 'i-flag-pt-1x1',
	zh: 'i-flag-cn-1x1',
} as const

const currentLocale = computed(() =>
		locales.value.find(i => i.code === locale.value) || { code: locale.value, name: locale.value }
)

async function changeLocale(code: typeof locale.value) {
	if (code === locale.value) return

	await setLocale(code)
	setLocaleCookie(code)
	userPrefsStore.setLanguage(code)
}

const items = computed<DropdownMenuItem[]>(() => 
	locales.value.map(loc => ({
		label: loc.name,
		icon: flagIcons[loc.code as keyof typeof flagIcons] || 'i-solar-globus-bold-duotone',
		trailing: loc.code === locale.value ? { icon: 'i-solar-check-circle-bold-duotone', color: 'green' } : undefined,
		onSelect: () => changeLocale(loc.code as typeof locale.value)
	}))
)

</script>

<template>
	<ClientOnly>
		<UDropdownMenu 
			:items="items" 
			:content="{ align: 'start', side: 'top', sideOffset: 8 }"
			:ui="{
				content: 'max-h-60 overflow-y-auto'
			}"
		>
			<UButton
				color="neutral"
				variant="ghost"
				class="flex items-center gap-2"
				:icon="flagIcons[locale as keyof typeof flagIcons] || 'i-solar-globus-bold-duotone'"
			>
				<span>{{ currentLocale.name }}</span>
			</UButton>
		</UDropdownMenu>
	</ClientOnly>
</template>
