<!-- components/AppHeader.vue -->
<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { isAnonymousUser, isAuthenticatedUser } from '~/composables/useUserUtils'
import { useNotifications } from '~/composables/useNotifications'
import {ref} from "vue";
import {useRouter} from "#vue-router";
import {useLobby} from "~/composables/useLobby";
const { getActiveLobbyForUser } = useLobby();
const router = useRouter();
const userStore = useUserStore()
const { notify } = useNotifications()
const isMobileMenuOpen = ref(false);
const showJoin = ref(false);
const showCreate = ref(false);
const isJoining = ref(false);
const isCreating = ref(false);

const handleLoginWithDiscord = async (): Promise<void> => {
  try {
    await userStore.loginWithProvider('discord');

    // Fetch full session + user info after login
    await userStore.fetchUserSession();

    notify({ title: "Logged in with Discord", color: "success" });
  } catch (err: any) {
    console.error("Login error:", err);

    let message = "Login failed";

    if (err?.message?.includes("already exists")) {
      message = "This Discord account is already tied to another user.";
    }

    notify({ title: message, color: "error" });
  }
};

const handleLoginWithGoogle = async (): Promise<void> => {
  try {
    await userStore.loginWithProvider('google');

    // Fetch full session + user info after login
    await userStore.fetchUserSession();

    notify({ title: "Logged in with Google", color: "success" });
  } catch (err: any) {
    console.error("Login error:", err);

    let message = "Login failed";

    if (err?.message?.includes("already exists")) {
      message = "This Google account is already tied to another user.";
    }

    notify({ title: message, color: "error" });
  }
};

const handleLogout = async () => {
  try {
    await userStore.logout()
    notify({title: "Logged out", color: "success"})
  } catch (err) {
    notify({title: "Logout failed", color: "error"})
    console.error("Logout error:", err)
  }
}

const avatarUrl = computed(() => {
  const user = userStore.user;
  if (!user?.prefs) return null;

  if (user.provider === 'discord' && user.prefs.discordUserId && user.prefs.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.prefs.discordUserId}/${user.prefs.avatar}.png`;
  }

  if (user.provider === 'google' && user.prefs.avatar) {
    return user.prefs.avatar; // Google usually gives a direct URL
  }

  return null;
});

const checkForActiveLobbyAndJoin = async () => {
	try {
		isJoining.value = true;

		if (userStore.user) {
			const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
			if (activeLobby) {
				notify({
					title: 'Redirecting to your active game',
					color: 'info',
					icon: 'i-mdi-controller',
					duration: 2000,
				});
				await router.push(`/game/${activeLobby.code}`);
				return;
			}
		}

		showJoin.value = true;
	} catch (error: unknown) {
		console.error('Error checking for active lobby:', error);
		showJoin.value = true;
	} finally {
		isJoining.value = false;
	}
};

const checkForActiveLobbyAndCreate = async () => {
	try {
		isCreating.value = true;

		if (!userStore.user) {
			showCreate.value = true;
			return;
		}

		// Log runtime configuration for debugging
		const config = useRuntimeConfig();
		console.log('Runtime configuration before creating lobby:', {
			databaseId: config.public.appwriteDatabaseId,
			lobbyCollectionId: config.public.appwriteLobbyCollectionId,
			playerCollectionId: config.public.appwritePlayerCollectionId
		});

		const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
		if (activeLobby) {
			notify({
				title: 'Redirecting to your active game',
				color: 'info',
				icon: 'i-mdi-controller',
				duration: 2000,
			});
			await router.push(`/game/${activeLobby.code}`);
		} else {
			showCreate.value = true;
		}
	} catch (error: unknown) {
		// Check if it's an AppwriteException with collection not found error
		if (error instanceof Error &&
				'code' in error &&
				error.code === 404 &&
				error.message?.includes('Collection with the requested ID could not be found')) {
			console.warn('Collections not initialized, showing create dialog');
			showCreate.value = true;
			return;
		}

		console.error('Error checking for active lobby:', error);
		showCreate.value = true;
	} finally {
		isCreating.value = false;
	}
};

const handleJoined = (code: string, isCreator = false) => {
	notify({
		title: 'Loading game lobby...',
		color: 'info',
		icon: 'i-mdi-loading i-spin',
		duration: 3000,
	});
	router.push(`/game/${code}${isCreator ? '?creator=true' : ''}`);
};
</script>

<template>
	<header class="fixed top-0 flex w-full items-center p-4 backdrop-blur-2xl text-white shadow-md font-['Bebas_Neue'] text-2xl font-medium border-b-2 border-slate-700/25">
		<UButton
				icon="i-heroicons-bars-3"
				color="neutral"
				variant="ghost"
				size=""
				@click="isMobileMenuOpen = true"
				class="md:hidden absolute right-2 w-8 h-8"
		/>
		<div class="flex-1">
			<NuxtLink to="/" class="">Unfit For Print</NuxtLink>
		</div>
		<nav class="flex items-center gap-2 justify-end not-md:hidden">
			<div class="mr-2">
				<img
						v-if="avatarUrl"
						:src="avatarUrl"
						alt="avatar"
						class="w-8 h-8 rounded-full"
				/>
			</div>
			<span v-if="isAuthenticatedUser(userStore.user)" class="text-xl text-slate-300">Welcome! {{userStore.user.name.toUpperCase()}}</span>
			<UButton size="lg" @click="checkForActiveLobbyAndCreate" :loading="isCreating" :disabled="!isAuthenticatedUser(userStore.user)" class="text-xl py-2 px-4 cursor-pointer" color="warning" variant="ghost" icon="i-solar-magic-stick-3-bold-duotone">{{ isAuthenticatedUser(userStore.user) ? 'Create Game' : 'Log In To Create Game'}}</UButton>
			<UButton @click="checkForActiveLobbyAndJoin" :loading="isJoining" class="text-xl py-2 px-4 cursor-pointer" color="success" variant="ghost" icon="i-solar-hand-shake-line-duotone">Join Game</UButton>

			<template v-if="isAuthenticatedUser(userStore.user)">
				<UButton to="/profile" class="text-xl py-2 px-4 cursor-pointer" color="secondary" variant="ghost" icon="i-solar-user-id-bold-duotone">Profile</UButton>
				<UButton to="/game" class="text-xl py-2 px-4 cursor-pointer" color="warning" variant="ghost" icon="i-solar-gamepad-bold-duotone">Games</UButton>
				<UButton @click="handleLogout" class="text-xl py-2 px-4 cursor-pointer" color="error" variant="ghost" icon="i-solar-logout-3-bold-duotone">Logout</UButton>
			</template>

			<template v-else>
				<UButton @click="handleLoginWithGoogle" color="secondary" variant="ghost" icon="i-logos-google-icon" class="text-xl py-2 px-4 cursor-pointer">Login With Google</UButton>
				<UButton @click="handleLoginWithDiscord" color="secondary" variant="ghost" icon="i-logos-discord-icon" class="text-xl py-2 px-4 cursor-pointer">Login With Discord</UButton>
			</template>
		</nav>
	</header>

	<!-- Mobile Navigation Slideover -->
	<USlideover v-model:open="isMobileMenuOpen" class="md:hidden">
		<template #content>
			<div class="p-4 flex flex-col gap-4">
				<div class="flex justify-between items-center mb-6">
					<UButton
						icon="i-lucide-x"
						color="neutral"
						variant="ghost"
						size="xl"
						@click="isMobileMenuOpen = false"
						class="absolute right-4 top-4 w-8 h-8 "
					/>
				</div>

				<div class="flex items-center gap-2 mb-4">
					<img
						v-if="avatarUrl"
						:src="avatarUrl"
						alt="avatar"
						class="w-10 h-10 rounded-full"
					/>
					<span v-if="isAuthenticatedUser(userStore.user)" class="text-xl">Welcome! {{userStore.user.name.toUpperCase()}}</span>
				</div>

				<UButton block size="xl" @click="checkForActiveLobbyAndCreate" :loading="isCreating" :disabled="!isAuthenticatedUser(userStore.user)" class="mb-2 text-xl py-3" color="warning" variant="soft" icon="i-solar-magic-stick-3-bold-duotone">
					{{ isAuthenticatedUser(userStore.user) ? 'Create Game' : 'Log In To Create Game'}}
				</UButton>

				<UButton block size="xl" @click="checkForActiveLobbyAndJoin" :loading="isJoining" class="mb-2 text-xl py-3" color="success" variant="soft" icon="i-solar-hand-shake-line-duotone">
					Join Game
				</UButton>

				<template v-if="isAuthenticatedUser(userStore.user)">
					<UButton block to="/profile" class="mb-2 text-xl py-3" color="secondary" variant="soft" icon="i-solar-user-id-bold-duotone">
						Profile
					</UButton>
					<UButton block to="/game" class="mb-2 text-xl py-3" color="warning" variant="soft" icon="i-solar-gamepad-bold-duotone">
						Games
					</UButton>
					<UButton block @click="handleLogout" class="mb-2 text-xl py-3" color="error" variant="soft" icon="i-solar-logout-3-bold-duotone">
						Logout
					</UButton>
				</template>

				<template v-else>
					<UButton block @click="handleLoginWithGoogle" class="mb-2 text-xl py-3" color="secondary" variant="soft" icon="i-logos-google-icon">
						Login With Google
					</UButton>
					<UButton block @click="handleLoginWithDiscord" class="mb-2 text-xl py-3" color="secondary" variant="soft" icon="i-logos-discord-icon">
						Login With Discord
					</UButton>
				</template>
			</div>

		</template>
	</USlideover>

	<!-- Modals (shared between mobile and desktop) -->
	<UModal v-model:open="showJoin" title="Join a Lobby">
		<template #body>
			<JoinLobbyForm @joined="handleJoined" />
		</template>
	</UModal>

	<UModal v-model:open="showCreate" title="Create a Lobby">
		<template #body>
			<CreateLobbyDialog @created="handleJoined" />
		</template>
	</UModal>
</template>
