// stores/uiStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
    const showPolicy = ref(false)
    const showSettings = ref(false)

    function togglePolicyModal(isOpen: boolean) {
        showPolicy.value = isOpen
    }

    function toggleSettings(isOpen?: boolean) {
        showSettings.value = typeof isOpen === 'boolean' ? isOpen : !showSettings.value
    }

    return { showPolicy, showSettings, togglePolicyModal, toggleSettings }
})
