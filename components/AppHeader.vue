<!-- components/AppHeader.vue -->
<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { isAuthenticatedUser } from '~/composables/useUserUtils'
import { useNotifications } from '~/composables/useNotifications'
import {ref} from "vue";
import {useRouter} from "#vue-router";
import {useLobby} from "~/composables/useLobby";
import { useUiStore } from '~/stores/uiStore';
import { useShrinkOnScroll } from '~/composables/useShrinkOnScroll'

const { isShrunk } = useShrinkOnScroll(50) // shrink after scrolling 50px
const { getActiveLobbyForUser } = useLobby();
const router = useRouter();
const userStore = useUserStore()
const uiStore = useUiStore();
const { notify } = useNotifications()
const isMobileMenuOpen = ref(false);
const showJoin = ref(false);
const showCreate = ref(false);
const isJoining = ref(false);
const isCreating = ref(false);
const config = useRuntimeConfig();

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

const openPolicyModal = () => {
	isMobileMenuOpen.value = false;
	uiStore.togglePolicyModal(true);
};

</script>

<template class="">
	<header class="fixed top-0 left-0 right-0 z-50 flex w-full h-16 items-center p-4 backdrop-blur-2xl text-white shadow-md text-2xl font-medium border-b-2 border-slate-700/25 transition-all duration-250 linear"
	>
		<UButton
				icon="i-heroicons-bars-3"
				color="neutral"
				variant="ghost"
				size=""
				@click="isMobileMenuOpen = true"
				class="lg:hidden absolute right-4 p-4"
		/>
		<div class="flex-1 flex">
			<NuxtLink to="/" class="font-['Bebas_Neue'] cursor-pointer" >
				<svg class="text-white w-18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 228.17 124.76">
					<path fill="transparent" stroke="black" stroke-miterlimit="10" stroke-width="10px" d="M175.88,13.19c-7.43-1.67-13.01-2.26-20.32-3.26-2.39-.33-4.52-.86-6.37-1.14-.65-1.95-1.8-3.55-4-3.78-2.19-.23-13.3,2.04-16.47,2.56-14.13,2.33-28.91,5.04-43.02,7-3.32.46-5.91.73-7.82,1.26-2.98.26-4.24,2.13-4.75,7.67-1.15,12.45-3.6,22.92-6.07,35.04-.25,1.22-.6,3.01-.95,4.77-.74,3.71-1.42,7.12-2.21,10.7-2.7,12.17-5.72,17.87-18.34,17.43-12-3.91-12.89-10.31-11.25-22.66.48-3.63,1.02-7.08,1.59-10.81.27-1.77.55-3.58.74-4.8,1.33-8.73,2.5-17.56,4.16-26.22.68-3.52,3.24-11.52,2.53-14.46-1.09-4.55-9.99-4.9-14.38-5.59-8.72-1.37-12.49-4.32-14.23,4.54-2.03,12.43-4.19,24.83-6.09,37.27-.31,2.04-.52,3.4-.72,4.71-.66,4.24-1.26,8.15-1.68,11.29-3.79,28.48-.59,46.54,34.92,51.61,26.88,5.69,38.57-2.29,45.36-18.94.76,4.61,1.48,9.21,2.06,13.76,1.03,8.04,1.71,9.83,11.23,7.93,4.89-.98,9.28-1.47,14.05-2.31,2.88-.51,5.68-1,6.06-3.91.25-1.95-2.11-13.33-2.6-16.28-.78-4.72-2.07-10.17-2.62-14.76-.29-2.46-.5-4.34,2.34-5.47,1.58-.63,8.72-1.67,14.33-2.43-1.5,8.81-3.01,17.7-4.75,26.29-1.86,9.17-3.99,11.24,7.54,13.04,4.9.76,9.3,1.73,14.05,2.55,2.95.51,5.65.91,6.91-1.78,1.04-2.21,2.68-14.46,3.28-17.87.62-3.5,1.57-12.28,3.05-14.89,1.17-1.3,2.95-.93,4.76-.65,22.17,3.34,48.4,2.11,55.33-19.98,8.72-27.78-19.31-41.51-45.66-47.42ZM108.32,45.3c-1.29-6.34,1.11-7.95,7.89-8.84,7.54-.99,14.8-2.33,22.28-3.43-.75,4.31-1.5,8.61-2.26,12.92-5.61.99-11.33,1.98-16.89,3.04-5.66,1.08-9.8,2.31-11.02-3.69ZM194.57,51.28c-1.55,8.74-17.98,6.74-29,4.35l3.35-18.92c12.35,2.22,27.07,6.56,25.65,14.57Z"/>
					<path fill="currentColor" d="M158.4,96.14c-.6,3.41-2.24,15.66-3.28,17.87-1.27,2.69-3.96,2.28-6.91,1.78-4.76-.82-9.16-1.79-14.05-2.55-11.54-1.8-9.4-3.87-7.54-13.04,2.52-12.42,4.54-25.45,6.76-37.98,2.81-15.87,5.62-31.69,8.28-47.59,1.46-8.72,6.41-5.72,13.92-4.69,7.31,1,12.89,1.59,20.32,3.26,26.35,5.91,54.38,19.64,45.66,47.42-6.93,22.09-33.16,23.32-55.33,19.98-1.81-.27-3.59-.65-4.76.65-1.49,2.61-2.44,11.39-3.05,14.89ZM165.57,55.63c11.02,2.38,27.45,4.39,29-4.35,1.42-8.01-13.3-12.35-25.65-14.57l-3.35,18.92Z"/>
					<path fill="currentColor" d="M83.88,81.74l-6.38-38.7c-1-6.06-1.95-11.93-3.17-17.97-1.91-9.42,1.63-9.14,11.37-10.49,14.11-1.96,28.89-4.67,43.02-7,3.16-.52,14.28-2.79,16.47-2.56,4.65.48,4.61,7.06,5.05,10.2.41,2.95,2.45,11.25,1.65,13.5-1.21,3.4-9.37,3.73-12.9,4.24-7.65,1.11-15.06,2.49-22.78,3.5-6.78.89-9.18,2.5-7.89,8.84,1.22,6,5.36,4.78,11.02,3.69,5.85-1.12,11.89-2.15,17.77-3.2,7.34-1.3,7.43,1.5,8.23,7.34.56,4.04,1.18,7.43,1.94,11.42,1.41,7.36-1.95,7.41-9.67,8.49-3.63.51-18.26,2.33-20.6,3.28-2.83,1.14-2.63,3.01-2.34,5.47.55,4.58,1.84,10.04,2.62,14.76.49,2.96,2.86,14.33,2.6,16.28-.38,2.91-3.17,3.4-6.06,3.91-4.77.84-9.16,1.33-14.05,2.31-9.52,1.9-10.2.12-11.23-7.93-1.24-9.71-3.1-19.7-4.69-29.39Z"/>
					<path fill="currentColor" d="M41.15,116.32C5.64,111.25,2.44,93.2,6.23,64.71c.42-3.14,1.02-7.05,1.68-11.29.2-1.31.41-2.67.72-4.71,1.9-12.44,4.06-24.85,6.09-37.27,1.74-8.86,5.51-5.91,14.23-4.54,4.4.69,13.29,1.05,14.38,5.59.7,2.94-1.86,10.94-2.53,14.46-1.67,8.66-2.83,17.49-4.16,26.22-.19,1.23-.47,3.04-.74,4.8-.58,3.74-1.11,7.18-1.59,10.81-1.64,12.35-.76,18.75,11.25,22.66,12.62.45,15.64-5.26,18.34-17.43.79-3.58,1.47-7,2.21-10.7.35-1.75.71-3.55.95-4.77,2.47-12.13,4.92-22.6,6.07-35.04.86-9.25,3.79-8.29,13.35-6.62,3.21.56,14.77,1.96,16.11,4.89.82,1.8-1.59,10.3-2.03,12.71-1.84,9.87-3.67,19.63-5.65,29.48-.41,2.02-.68,3.37-.94,4.67-.84,4.21-1.61,8.09-2.3,11.18-6.22,28.05-15.42,43.91-50.51,36.49Z"/>
					<path fill="black" opacity="0.5" d="M141.64,14.62c-1.03,6.15-2.08,12.28-3.15,18.41.17-.02.33-.05.49-.07,3.53-.51,11.7-.84,12.9-4.24.8-2.25-1.25-10.56-1.65-13.5-.23-1.65-.33-4.25-1.05-6.42-3.94-.61-6.56-.11-7.55,5.83Z"/>
					<path fill="black" opacity="0.5" d="M145.34,53.14c-.8-5.84-.9-8.64-8.23-7.34-.29.05-.59.1-.88.15-.95,5.42-1.91,10.83-2.87,16.26-.68,3.86-1.35,7.77-2.01,11.69,2.72-.37,5.08-.68,6.27-.84,7.72-1.09,11.08-1.14,9.67-8.49-.76-3.99-1.39-7.38-1.94-11.42Z"/>
					<path fill="black" opacity="0.5" d="M100.55,34.5c.45-2.41,2.86-10.91,2.03-12.71-1.34-2.93-12.9-4.33-16.11-4.89-3.83-.67-6.6-1.22-8.59-1.05-3.7,1.02-4.82,3.01-3.56,9.23,1.22,6.03,2.17,11.9,3.17,17.97l6.38,38.7c.85,5.16,1.77,10.4,2.64,15.63,2.07-5.09,3.69-10.98,5.15-17.54.69-3.1,1.46-6.97,2.3-11.18.26-1.3.53-2.65.94-4.67,1.98-9.85,3.81-19.61,5.65-29.48Z"/>
				</svg>
			</NuxtLink>
		</div>
		<nav class="flex items-center gap-2 justify-end not-lg:hidden font-['Bebas_Neue'] ml-auto">
			<div class="mr-2 m-full flex items-center gap-2">
				<img
						v-if="avatarUrl"
						:src="avatarUrl"
						alt="avatar"
						class="w-8 h-8 rounded-full"
				/>
			<span v-if="isAuthenticatedUser(userStore.user)" class="text-xl text-slate-300">Welcome, {{userStore.user.name.toUpperCase()}}!</span>
			</div>
			<UButton @click="checkForActiveLobbyAndJoin" :loading="isJoining" class="text-xl py-2 px-4 cursor-pointer" color="success" variant="ghost" icon="i-solar-hand-shake-line-duotone">Join Game</UButton>
			<UButton @click="checkForActiveLobbyAndCreate" :loading="isCreating" :disabled="!isAuthenticatedUser(userStore.user)" class="text-xl py-2 px-4 cursor-pointer" color="warning" variant="ghost" :icon="!isAuthenticatedUser(userStore.user) ? 'i-solar-double-alt-arrow-right-bold-duotone' : 'i-solar-magic-stick-3-bold-duotone'">{{ isAuthenticatedUser(userStore.user) ? 'Create Game' : 'Log In To Create Game'}}</UButton>

			<template v-if="isAuthenticatedUser(userStore.user)">
				<UButton to="/profile" class="text-xl py-2 px-4 cursor-pointer" color="secondary" variant="ghost" icon="i-solar-user-id-bold-duotone">Profile</UButton>
				<UButton to="/game" class="text-xl py-2 px-4 cursor-pointer" color="warning" variant="ghost" icon="i-solar-gamepad-bold-duotone">Games</UButton>
				<UButton @click="handleLogout" class="text-xl py-2 px-4 cursor-pointer" color="error" variant="ghost" icon="i-solar-logout-3-bold-duotone">Logout</UButton>
			</template>

			<template v-else>
				<UButton @click="handleLoginWithDiscord" color="secondary" variant="ghost" icon="i-logos-discord-icon" class="text-xl py-2 px-4 cursor-pointer">Login With Discord</UButton>
			</template>
		</nav>
	</header>

	<!-- Mobile Navigation Slideover -->
	<USlideover v-model:open="isMobileMenuOpen" class="lg:hidden">
		<template #content>
			<div class="p-4 flex flex-col gap-4 font-['Bebas_Neue']">

				<div class="flex items-center gap-2 mb-4">
					<img
							v-if="avatarUrl"
							:src="avatarUrl"
							alt="avatar"
							class="w-10 h-10 rounded-full"
					/>
					<span v-if="isAuthenticatedUser(userStore.user)" class="text-xl">Welcome, {{userStore.user.name.toUpperCase()}}!</span>
					<span v-else class="text-xl">Hello There, Random User!</span>
				</div>
				<div class="flex justify-between items-center">
					<UButton
						icon="i-lucide-x"
						color="neutral"
						variant="ghost"
						size="xl"
						@click="isMobileMenuOpen = false"
						class="absolute right-4 top-4"
					/>
				</div>

				<UButton block size="xl" @click="checkForActiveLobbyAndJoin" :loading="isJoining" class="mb-2 text-xl py-3 cursor-pointer" color="success" variant="soft" icon="i-solar-hand-shake-line-duotone">
					Join Game
				</UButton>

				<UButton block size="xl" @click="checkForActiveLobbyAndCreate" :loading="isCreating" :disabled="!isAuthenticatedUser(userStore.user)" class="mb-2 text-xl py-3 cursor-pointer" color="warning" variant="soft" :icon="!isAuthenticatedUser(userStore.user) ? 'i-solar-double-alt-arrow-down-bold-duotone' : 'i-solar-magic-stick-3-bold-duotone'">
					{{ isAuthenticatedUser(userStore.user) ? 'Create Game' : 'Log In To Create Game'}}
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
					<USeparator class="my-2" />
					<UButton block @click="handleLoginWithDiscord" class="mb-2 text-xl py-3" color="secondary" variant="soft" icon="i-logos-discord-icon">
						Login With Discord
					</UButton>
					<div class="absolute bottom-0 left-0 right-0 p-4 text-center">
						<USeparator class="my-2" />
						<UButton block @click="openPolicyModal" class="mb-2 text-xl py-3" color="neutral" variant="soft" icon="i-solar-shield-check-line-duotone">
							Privacy Policy
						</UButton>
						<p class="text-sm">© 2025 Unfit for Print. All rights reserved.</p>
						<p class="text-sm">Made with ❤️ by MYND @ PPO.GG</p>
						<NuxtLink to="https://git.ppo.gg/MYND/unfit-for-print" target="_blank" class="">V-{{ $config.public.appVersion }}</NuxtLink>
					</div>
				</template>

				<div class="absolute bottom-0 left-0 right-0 p-4 text-center">
					<USeparator class="my-2" />
					<UButton block @click="openPolicyModal" class="mb-2 text-xl py-3" color="neutral" variant="soft" icon="i-solar-shield-check-line-duotone">
						Privacy Policy
					</UButton>
					<p class="text-sm">© 2025 Unfit for Print. All rights reserved.</p>
					<p class="text-sm">Made with ❤️ by MYND @ PPO.GG</p>
					<NuxtLink to="https://git.ppo.gg/MYND/unfit-for-print" target="_blank" class="">V-{{ $config.public.appVersion }}</NuxtLink>
				</div>
			</div>

		</template>
	</USlideover>

	<!-- Modals (shared between mobile and desktop) -->
	<UModal v-model:open="showJoin" :overlay="false" title="Join a Lobby" class="cursor-default">
		<template #body>
			<JoinLobbyForm @joined="handleJoined" />
		</template>
	</UModal>

	<UModal v-model:open="showCreate" :overlay="false" title="Create a Lobby">
		<template #body>
			<CreateLobbyDialog @created="handleJoined" />
		</template>
	</UModal>
</template>
