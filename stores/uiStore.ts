// stores/uiStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
    // State for controlling the privacy policy modal
    const showPolicy = ref(false)

    // Action to toggle the modal
    function togglePolicyModal(isOpen: boolean) {
        showPolicy.value = isOpen
    }

    return { showPolicy, togglePolicyModal }
})
