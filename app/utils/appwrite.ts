// utils/appwrite.ts
import type { Client, Databases, Account, Functions, Teams } from "appwrite";

export const getAppwrite = () => {
  if (import.meta.server) {
    return {
      databases: undefined as unknown as Databases,
      account: undefined as unknown as Account,
      client: undefined as unknown as Client,
      functions: undefined as unknown as Functions,
      teams: undefined as unknown as Teams,
    };
  }

  const { databases, account, client, functions, teams } = useAppwrite();

  return { databases, account, client, functions, teams };
};
