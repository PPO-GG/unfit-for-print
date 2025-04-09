// composables/useAppwrite.ts
export const useAppwrite = () => {
  if (import.meta.server) {
    return {
      client: null,
      account: null,
      databases: null
    };
  }

  const { $appwrite } = useNuxtApp();
  return $appwrite;
};