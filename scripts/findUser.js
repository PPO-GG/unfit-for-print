import dotenv from 'dotenv';
dotenv.config();

import { Client, Users } from 'node-appwrite';
import prompts from 'prompts';

const client = new Client()
    .setEndpoint(process.env.NUXT_PUBLIC_APPWRITE_URL)
    .setProject(process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const users = new Users(client);

(async () => {
    console.log("🔍 Scanning users for missing emails...");

    const result = await users.list([], 100); // Extend this if needed with pagination
    const ghostUsers = result.users.filter(u =>
        !u.email &&
        u.providers?.some(p => p.email)
    );

    if (ghostUsers.length === 0) {
        console.log("✅ No ghost users found! All users have visible emails.");
        return;
    }

    console.log(`👻 Found ${ghostUsers.length} ghost user(s):\n`);

    for (const user of ghostUsers) {
        const providerEmail = user.providers.find(p => p.email)?.email;

        console.log(`🆔 ID: ${user.$id}`);
        console.log(`📛 Name: ${user.name}`);
        console.log(`🕵️ Email (from provider): ${providerEmail}`);
        console.log(`🔗 Providers: ${user.providers.map(p => p.provider).join(', ')}`);

        const { fix } = await prompts({
            type: 'confirm',
            name: 'fix',
            message: `Do you want to set this user's email to: ${providerEmail}?`,
            initial: true,
        });

        if (fix && providerEmail) {
            try {
                await users.updateEmail(user.$id, providerEmail);
                console.log("✅ Email updated successfully!\n");
            } catch (err) {
                console.error("❌ Failed to update email:", err.message);
            }
        } else {
            console.log("⏩ Skipped.\n");
        }
    }

    console.log("🏁 Done!");
})();
