<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { locale, locales, setLocale, setLocaleCookie } = useI18n()
const router = useRouter()
const userPrefsStore = useUserPrefsStore()
const switchLocalePath = useSwitchLocalePath()

const flagIcon = (code: string) => `i-flag-${code}-1x1`

const currentLocale = computed(() =>
		locales.value.find(i => i.code === locale.value) || { code: locale.value, name: locale.value }
)

async function changeLocale(code: typeof locale.value) {
	if (code === locale.value) return

	await setLocale(code)
	setLocaleCookie(code)
	userPrefsStore.setLanguage(code)

	// No need to navigate to a new URL with the 'no_prefix' strategy
}

const items = computed<DropdownMenuItem[]>(() => 
	locales.value.map(loc => ({
		label: loc.name,
		icon: flagIcon(loc.code) || 'i-heroicons-globe-alt',
		trailing: loc.code === locale.value ? { icon: 'i-heroicons-check', color: 'green' } : undefined,
		onSelect: () => changeLocale(loc.code as typeof locale.value)
	}))
)

</script>

<template>
	<UDropdownMenu 
		:items="items" 
		:content="{ align: 'start', side: 'top', sideOffset: 8 }"
	>
		<UButton
			color="neutral"
			variant="ghost"
			class="flex items-center gap-2"
			:icon="flagIcon(locale) || 'i-heroicons-globe-alt'"
		>
			<span>{{ currentLocale.name }}</span>
		</UButton>
	</UDropdownMenu>
</template>
