import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export function useBrowserDetect() {
    const showFirefoxDialog = ref(false)
    const isFirefox = ref(false)

    const detectBrowser = () => {
        if (typeof window === 'undefined') return false
        isFirefox.value = navigator.userAgent.toLowerCase().includes('firefox')
    }

    let proceedResolver: ((value: boolean) => void) | null = null
    let proceedRejecter: ((reason?: any) => void) | null = null

    const handleProceed = () => {
        showFirefoxDialog.value = false
        if (proceedResolver) {
            proceedResolver(true)
            proceedResolver = null
            proceedRejecter = null
        }
    }

    const handleCancel = () => {
        showFirefoxDialog.value = false
        if (proceedRejecter) {
            proceedRejecter(false)
            proceedResolver = null
            proceedRejecter = null
        }
    }

    const showFirefoxPrivacyWarning = async (): Promise<boolean> => {
        if (!isFirefox.value) return true

        // Show the dialog and wait for user confirmation
        showFirefoxDialog.value = true

        return new Promise<boolean>((resolve, reject) => {
            proceedResolver = resolve
            proceedRejecter = reject
        })
    }

    return {
        isFirefox,
        detectBrowser,
        showFirefoxPrivacyWarning,
        showFirefoxDialog,
        handleProceed,
        handleCancel
    }
}
