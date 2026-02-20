<template>
  <div class="flex flex-col items-center justify-center min-h-screen">
    <div class="text-center">
      <h2 class="text-2xl font-bold mb-4">{{ statusText }}</h2>
      <p v-if="error" class="text-red-500 mt-2">{{ error }}</p>
      <div
        v-else
        class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/userStore";

const userStore = useUserStore();
const router = useRouter();
const route = useRoute();
const error = ref<string | null>(null);
const statusText = ref("Signing you in...");

onMounted(async () => {
  try {
    // Appwrite redirects here with userId and secret as query params
    // after the user authorizes on Discord.
    const userId = route.query.userId as string;
    const secret = route.query.secret as string;

    if (userId && secret) {
      // Exchange the one-time token for a session using the CLIENT SDK.
      // This lets the SDK manage its own session cookies/storage.
      const { account } = useAppwrite();
      await account.createSession(userId, secret);
      statusText.value = "Session created, loading profile...";
    }

    // Hydrate the store from the now-active session
    await userStore.fetchUserSession();

    if (userStore.isLoggedIn) {
      statusText.value = "Welcome back!";
      await router.replace("/");
    } else {
      error.value = "Login failed. Please try again.";
      setTimeout(() => router.replace("/"), 3000);
    }
  } catch (err: any) {
    console.error("[Auth Callback] Error:", err);
    error.value = err?.message || "Something went wrong. Redirecting...";
    setTimeout(() => router.replace("/"), 3000);
  }
});
</script>
