<script setup lang="ts">
definePageMeta({
	middleware: 'admin'
})
const userStore = useUserStore()

// For tab navigation
const activeTab = ref('cards')
</script>

<template>
	<div class="p-6 space-y-6 max-w-7xl mx-auto">
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
			<div>
				<h1 class="text-5xl font-bold font-['Bebas_Neue']">Admin Dashboard</h1>
				<p class="text-gray-400 text-xl mt-1 font-['Bebas_Neue']">Manage cards and monitor game lobbies</p>
			</div>
		</div>

		<!-- Tab Navigation for smaller screens -->
		<div class="block lg:hidden mb-6">
			<UTabs v-model="activeTab" :items="[
			  { label: 'Card Manager', slot: 'cards', value: 'cards', icon: 'i-heroicons-document-text' },
			  { label: 'Lobby Monitor', slot: 'lobbies', value: 'lobbies', icon: 'i-heroicons-users' },
			  { label: 'User Manager', slot: 'users', value: 'users', icon: 'i-heroicons-users' }
			]">
				<template #cards>
					<div class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6 rounded-lg">
						<AdminCardManager />
					</div>
				</template>
				<template #lobbies>
					<div class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6 rounded-lg">
						<AdminLobbyMonitor />
					</div>
				</template>
				<template #users>
					<div class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6 rounded-lg">
						<AdminUserManager />
					</div>
				</template>
			</UTabs>
		</div>

		<!-- Desktop Layout -->
		<div class="hidden lg:block columns-1 sm:columns-1 md:columns-2 gap-6">
			<!-- Card Manager -->
			<UCard class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6">
				<template #header>
					<div class="flex justify-between items-center">
						<h2 class="text-2xl font-semibold font-['Bebas_Neue']">Card Manager</h2>
						<UBadge icon="i-solar-info-square-bold-duotone" size="md" color="info" variant="solid">Manage game cards - add, search, edit, delete, or toggle active status</UBadge>
					</div>
				</template>
				<AdminCardManager />
			</UCard>

			<!-- Lobby Monitor -->
			<UCard class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6">
				<template #header>
					<div class="flex justify-between items-center">
						<h2 class="text-2xl font-semibold font-['Bebas_Neue']">Active Lobbies</h2>
							<UBadge icon="i-solar-info-square-bold-duotone" size="md" color="info" variant="solid">Monitor active game lobbies and players</UBadge>
					</div>
				</template>
				<AdminLobbyMonitor />
			</UCard>

			<!-- User Manager -->
			<UCard class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6">
				<template #header>
					<div class="flex justify-between items-center">
						<h2 class="text-2xl font-semibold font-['Bebas_Neue']">Users Manager</h2>
						<UBadge icon="i-solar-info-square-bold-duotone" size="md" color="info" variant="solid">Manage Authenticated Users</UBadge>
					</div>
				</template>
				<AdminUserManager />
			</UCard>

		</div>
	</div>
</template>
