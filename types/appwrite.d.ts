// types/appwrite.d.ts
import type { Client, Account, Databases, Functions } from 'appwrite';

export interface AppwriteContext {
    client: Client | null;
    account: Account | null;
    databases: Databases | null;
    functions: Functions | null;
}
declare module '#app' {
    interface NuxtApp {
        $appwrite: AppwriteContext;
    }
}
export {};