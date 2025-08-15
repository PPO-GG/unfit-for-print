import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export function useBrowserDetect() {
    const showFirefoxDialog = ref(false)
    const isFirefox = ref(false)

    const detectBrowser = () => {
        if (typeof window === 'undefined') return false
        isFirefox.value = navigator.userAgent.toLowerCase().includes('firefox')
    }

    const showFirefoxPrivacyWarning = async (): Promise<boolean> => {
        if (!isFirefox.value) return true

        // Show the dialog and wait for user confirmation
        showFirefoxDialog.value = true
        
        return new Promise((resolve) => {
            // We'll use this to handle the proceed event
            const handleProceed = () => {
                showFirefoxDialog.value = false
                resolve(true)
            }

            // Export the handler so the component can call it
            return {
                showFirefoxDialog,
                handleProceed
            }
        })
    }

    return {
        isFirefox,
        detectBrowser,
        showFirefoxPrivacyWarning,
        showFirefoxDialog
    }
}
