// stores/uiStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
    const showPolicy = ref(false)
    function togglePolicyModal(isOpen: boolean) {
        showPolicy.value = isOpen
    }
    return { showPolicy, togglePolicyModal }
})
