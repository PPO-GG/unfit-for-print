import { useNuxtApp } from '#app';
import type { AppwriteContext } from '~/types/appwrite';

export const useAppwrite = (): AppwriteContext => {
  const { $appwrite } = useNuxtApp();

  if (import.meta.server) {
    console.warn('⚠️ useAppwrite should only be called on the client-side.');
    return $appwrite;
  }

  if (!$appwrite) {
    console.warn('⚠️ Missing $appwrite');
  }

  return $appwrite;
};