// plugins/i18n.client.ts
import { useUserPrefsStore } from '~/stores/userPrefsStore'

export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = nuxtApp.$i18n as I18n
  const { setLocaleCookie } = i18n
  const userPrefsStore = useUserPrefsStore()

  const preferred = userPrefsStore.preferredLanguage
  const current = i18n.locale.value

  // Function to find the best matching locale from browser languages
  const findBestMatchingLocale = (): string | null => {
    if (import.meta.client && navigator.languages && navigator.languages.length > 0) {
      const availableLocales = i18n.locales.value.map(locale => 
        typeof locale === 'string' ? locale : locale.code
      )

      // Try to find an exact match first
      for (const lang of navigator.languages) {
        const normalizedLang = lang.toLowerCase().split('-')[0] // Get the language part (e.g., 'en' from 'en-US')
        if (availableLocales.includes(normalizedLang)) {
          return normalizedLang
        }
      }
    }
    return null
  }

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
    // Try to detect the best matching locale from browser settings
    const bestMatch = findBestMatchingLocale()

    if (bestMatch && bestMatch !== current) {
      try {
        await i18n.setLocale(bestMatch)
        setLocaleCookie(bestMatch)
        userPrefsStore.setLanguage(bestMatch)
      } catch (error) {
        console.error('Failed to apply detected browser language:', error)
        // Fallback to storing the current locale
        userPrefsStore.setLanguage(current)
        setLocaleCookie(current)
      }
    } else {
      // Store the default detected language if no better match found
      userPrefsStore.setLanguage(current)
      setLocaleCookie(current)
    }
  }
})
