// utils/appwrite.ts
import {
  Client,
  Databases,
  Account,
  Functions,
  Teams,
  TablesDB,
} from "appwrite";

export const getAppwrite = () => {
  if (import.meta.server) {
    return {
      databases: undefined as unknown as Databases,
      account: undefined as unknown as Account,
      client: undefined as unknown as Client,
      functions: undefined as unknown as Functions,
      teams: undefined as unknown as Teams,
      tables: undefined as unknown as TablesDB,
    };
  }

  const { databases, account, client, functions, teams } = useAppwrite();
  const tables = new TablesDB(client);

  return { databases, account, client, functions, teams, tables };
};
