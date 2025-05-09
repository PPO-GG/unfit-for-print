<script setup lang="ts">
import { ref, onMounted } from 'vue'

const users = ref<any[]>([])
const loading = ref(true)
const teams = ref<any[]>([])
const userTeams = ref<Record<string, { teamId: string; membershipId: string }[]>>({})
const selectedTeam = ref('')

const fetchTeams = async () => {
	const res = await $fetch('/api/admin/teams')
	teams.value = res.teams
}

const fetchUserTeams = async (userId: string) => {
	const res = await $fetch('/api/admin/teams/memberships', {
		method: 'POST',
		body: { userId }
	})
	userTeams.value[userId] = res
}

const getTeamName = (teamId: string) => {
	return teams.value.find(t => t.$id === teamId)?.name || 'Unknown'
}

const addUserToTeam = async (userId: string, teamId: string) => {
	await $fetch('/api/admin/teams/update', {
		method: 'POST',
		body: { action: 'add', teamId, userId }
	})
	await fetchUserTeams(userId)
}

const removeUserFromTeam = async (userId: string, teamId: string, membershipId: string) => {
	await $fetch('/api/admin/teams/update', {
		method: 'POST',
		body: { action: 'remove', teamId, membershipId }
	})
	await fetchUserTeams(userId)
}

const deleteUser = async (userId: string) => {
	const confirmed = confirm('Are you sure you want to delete this user?')
	if (!confirmed) return

	try {
		const res = await $fetch('/api/admin/users/delete', {
			method: 'POST',
			body: { userId }
		})
		if (res.success) {
			users.value = users.value.filter(u => u.$id !== userId)
		} else {
			console.error('Delete failed:', res.message)
		}
	} catch (err) {
		console.error('Delete request failed:', err)
	}
}

onMounted(async () => {
	try {
		const res = await $fetch('/api/admin/users')
		users.value = res.users
		await fetchTeams()
		for (const user of users.value) {
			await fetchUserTeams(user.$id)
		}
	} catch (err) {
		console.error('Failed to fetch users or teams:', err)
	} finally {
		loading.value = false
	}
})
</script>

<template>
	<div>
		<p v-if="loading">Loading users...</p>
		<ul v-else class="space-y-4">
			<li v-for="user in users" :key="user.$id" class="bg-slate-700 p-4 rounded text-white space-y-2">
				<div class="flex justify-between items-center">
					<div class="flex gap-4 items-center flex-wrap">
						<div class="flex items-center gap-2">
							<span class="text-xl font-['Bebas_Neue']">{{ user.name || 'Unnamed User' }}</span>
							<UBadge v-if="user.emailVerification" color="primary">Verified</UBadge>
						</div>
						<div class="flex gap-2">
							<UBadge
									v-for="team in userTeams[user.$id] || []"
									:key="team.teamId"
									color="info"
									class="flex items-center gap-1"
							>
								{{ getTeamName(team.teamId) }}
								<UButton
										icon="i-solar-close-square-bold-duotone"
										size="xs"
										variant="link"
										color="error"
										@click="removeUserFromTeam(user.$id, team.teamId, team.membershipId)"
								/>
							</UBadge>
						</div>
					</div>
					<div class="text-right">
						<p class="text-sm text-gray-300">{{ user.email || '(anonymous)' }}</p>
						<p class="text-sm text-gray-500">Created: {{ new Date(user.$createdAt).toLocaleString() }}</p>
					</div>
					<UButton icon="i-solar-trash-bin-trash-bold-duotone" color="error" @click="deleteUser(user.$id)" />
				</div>
				<div>
					<USelectMenu
							v-model="selectedTeam"
							:items="teams.map(t => t.$id)"
							placeholder="Add to team"
							class="mt-2"
							@change="addUserToTeam(user.$id, selectedTeam)"
					/>
				</div>
			</li>
		</ul>
	</div>
</template>
