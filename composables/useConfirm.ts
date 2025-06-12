import { ref } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonText?: string;
  cancelButtonColor?: string;
}

// Create a composable that manages the confirm dialog state
export function useConfirm() {
  // Use nuxt's useState to make this state available globally
  const isOpen = useState('confirm-dialog-open', () => false);
  const resolvePromise = ref<((value: boolean) => void) | null>(null);
  const options = useState<ConfirmOptions>('confirm-dialog-options', () => ({
    title: 'Confirm',
    message: 'Are you sure you want to proceed?',
    confirmButtonText: 'Confirm',
    confirmButtonColor: 'primary',
    cancelButtonText: 'Cancel',
    cancelButtonColor: 'gray'
  }));

  function confirm(opts: Partial<ConfirmOptions> = {}): Promise<boolean> {
    return new Promise((resolve) => {
      // Merge default options with provided options
      options.value = {
        ...options.value,
        ...opts
      };

      resolvePromise.value = resolve;
      isOpen.value = true;
    });
  }

  function onConfirm() {
    isOpen.value = false;
    if (resolvePromise.value) {
      resolvePromise.value(true);
      resolvePromise.value = null;
    }
  }

  function onCancel() {
    isOpen.value = false;
    if (resolvePromise.value) {
      resolvePromise.value(false);
      resolvePromise.value = null;
    }
  }

  return {
    isOpen,
    options,
    confirm,
    onConfirm,
    onCancel
  };
}

// Add default export
export default useConfirm;
