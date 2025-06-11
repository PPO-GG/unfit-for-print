import { ref } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  buttonText?: string;
  buttonColor?: string;
  cancelButtonText?: string;
}

// Create a singleton instance for the confirm dialog
const isOpen = ref(false);
const resolvePromise = ref<((value: boolean) => void) | null>(null);
const options = ref<ConfirmOptions>({
  title: 'Confirm',
  message: 'Are you sure you want to proceed?',
  buttonText: 'Confirm',
  buttonColor: 'primary',
  cancelButtonText: 'Cancel'
});

export function useConfirm() {
  function confirm(opts: ConfirmOptions = {}): Promise<boolean> {
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

// For compatibility with the way it's used in components
export default (options: ConfirmOptions = {}) => {
  const { confirm } = useConfirm();
  return confirm(options);
};
