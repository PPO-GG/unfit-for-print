// types/appwrite.d.ts
import type { Client, Account, Databases, Functions, Teams } from 'appwrite';

export interface AppwriteContext {
    client: Client;
    account: Account;
    databases: Databases;
    functions: Functions;
    teams: Teams;
    safeConfig?: any; // Safe configuration with string-enforced collection IDs
}

declare module '#app' {
    interface NuxtApp {
        $appwrite: AppwriteContext;
    }
}
export {};
