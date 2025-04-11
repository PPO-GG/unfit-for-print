import type { AppwriteContext } from '~/types/appwrite';
export const useAppwrite = (): AppwriteContext => {
  if (import.meta.server) {
    return {
      client: null,
      account: null,
      databases: null,
      functions: null,
    };
  }

  const { $appwrite } = useNuxtApp();

  if (!$appwrite?.functions) {
    console.warn('⚠️ Missing functions in $appwrite');
  }

  return $appwrite;
};