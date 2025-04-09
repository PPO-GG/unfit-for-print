export const useAppwrite = () => {
  if (import.meta.server) {
    throw new Error("useAppwrite() was called on the server. This composable is client-only.");
  }

  const { $appwrite } = useNuxtApp();

  if (!$appwrite) {
    throw new Error("Appwrite plugin is not initialized. Are you calling this before NuxtApp is ready?");
  }

  return $appwrite;
}