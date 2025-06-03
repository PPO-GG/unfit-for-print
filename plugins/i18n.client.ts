// plugins/i18n.client.ts
import { useUserPrefsStore } from '~/stores/userPrefsStore'
import type { I18n } from '@nuxtjs/i18n/dist/runtime/composables'

export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = nuxtApp.$i18n as I18n
  const { setLocaleCookie } = i18n
  const userPrefsStore = useUserPrefsStore()

  const preferred = userPrefsStore.preferredLanguage
  const current = i18n.locale.value

  // Only change if preference and current differ
  if (preferred && preferred !== current) {
    try {
      await i18n.setLocale(preferred)
      setLocaleCookie(preferred)
    } catch (error) {
      console.error('Failed to apply stored language preference:', error)

      // Fallback to default locale if setting preferred language fails
      const defaultLocale = i18n.defaultLocale.value
      if (defaultLocale && defaultLocale !== current) {
        try {
          await i18n.setLocale(defaultLocale)
          setLocaleCookie(defaultLocale)
          userPrefsStore.setLanguage(defaultLocale)
        } catch (fallbackError) {
          console.error('Failed to apply default language:', fallbackError)
        }
      }
    }
  } else if (!preferred) {
    // Store the default detected language
    userPrefsStore.setLanguage(current)
    setLocaleCookie(current)
  }
})
