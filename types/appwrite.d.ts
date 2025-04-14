// types/appwrite.d.ts
import type { Client, Account, Databases, Functions } from 'appwrite';

export interface AppwriteContext {
    client: Client;
    account: Account;
    databases: Databases;
    functions: Functions;
}

declare module '#app' {
    interface NuxtApp {
        $appwrite: AppwriteContext;
    }
}
export {};