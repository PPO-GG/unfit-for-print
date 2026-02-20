// utils/appwrite.ts
export const getAppwrite = () => {
  if (import.meta.server)
    throw new Error("getAppwrite() cannot be used during SSR");

  const { databases, account, client, functions, teams } = useAppwrite();

  if (!databases || !account || !client || !functions)
    throw new Error("Appwrite not initialized");

  return { databases, account, client, functions, teams };
};
