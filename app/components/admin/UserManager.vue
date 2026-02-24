<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useUserStore } from "~/stores/userStore";

const userStore = useUserStore();

// Auth header helper
const authHeaders = () => ({
  Authorization: `Bearer ${userStore.session?.$id}`,
  "x-appwrite-user-id": userStore.user?.$id ?? "",
});

const users = ref<any[]>([]);
const loading = ref(true);
const teams = ref<any[]>([]);
const userTeams = ref<
  Record<string, { teamId: string; membershipId: string }[]>
>({});
const selectedTeam = ref("");

const fetchTeams = async () => {
  const res = await $fetch("/api/admin/teams", {
    headers: authHeaders(),
    navigate: false,
  });
  teams.value = res.teams;
};

const fetchUserTeams = async (userId: string) => {
  userTeams.value[userId] = await $fetch("/api/admin/teams/memberships", {
    headers: authHeaders(),
    navigate: false,
    method: "POST",
    body: { userId },
  });
};

const getTeamName = (teamId: string) => {
  return teams.value.find((t) => t.$id === teamId)?.name || "Unknown";
};

const addUserToTeam = async (userId: string, teamId: string) => {
  await $fetch("/api/admin/teams/update", {
    headers: authHeaders(),
    navigate: false,
    method: "POST",
    body: { action: "add", teamId, userId },
  });
  await fetchUserTeams(userId);
};

const removeUserFromTeam = async (
  userId: string,
  teamId: string,
  membershipId: string,
) => {
  await $fetch("/api/admin/teams/update", {
    headers: authHeaders(),
    navigate: false,
    method: "POST",
    body: { action: "remove", teamId, membershipId },
  });
  await fetchUserTeams(userId);
};

const deleteUser = async (userId: string) => {
  const confirmed = confirm("Are you sure you want to delete this user?");
  if (!confirmed) return;

  try {
    const res = await $fetch("/api/admin/users/delete", {
      headers: authHeaders(),
      navigate: false,
      method: "POST",
      body: { userId },
    });
    if (res.success) {
      users.value = users.value.filter((u) => u.$id !== userId);
    } else {
      console.error("Delete failed:", res.message);
    }
  } catch (err) {
    console.error("Delete request failed:", err);
  }
};

onMounted(async () => {
  try {
    // Ensure user session is initialized before making admin API requests
    if (!userStore.session) {
      await userStore.fetchUserSession();
    }

    if (!userStore.session) {
      console.error("UserManager: No session available after initialization");
      loading.value = false;
      return;
    }

    try {
      const res = await $fetch("/api/admin/users", {
        headers: authHeaders(),
        navigate: false,
      });
      users.value = res.users;

      await fetchTeams();

      for (const user of users.value) {
        await fetchUserTeams(user.$id);
      }
    } catch (apiErr) {
      console.error("UserManager: API request failed:", apiErr);
    }
  } catch (err) {
    console.error("UserManager: Failed to fetch users or teams:", err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-3">
      <!-- Skeleton cards -->
      <div
        v-for="i in 5"
        :key="i"
        class="bg-slate-700 rounded p-4 flex justify-between items-center relative"
      >
        <div class="max-w-xl mb-4 w-full">
          <USkeleton class="h-5 w-full" />
          <USkeleton class="h-5 w-3/4 mt-2" />
        </div>
        <div class="flex gap-2 absolute left-0 bottom-0 m-2">
          <span class="ml-2 flex items-center">
            <USkeleton class="h-4 w-20" />
          </span>
          <span class="ml-2 flex items-center">
            <USkeleton class="h-4 w-20" />
          </span>
        </div>
        <div class="flex items-center gap-1">
          <USkeleton class="h-8 w-8 rounded" />
          <USkeleton class="h-8 w-8 rounded" />
          <USkeleton class="h-8 w-8 rounded" />
          <USkeleton class="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
    <ul v-else class="space-y-4">
      <li
        v-for="user in users"
        :key="user.$id"
        class="bg-slate-700 p-4 rounded text-white space-y-2"
      >
        <div class="flex justify-between items-center">
          <div class="flex gap-4 items-center flex-wrap">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ user.name || "Unnamed User" }}</span>
              <UBadge v-if="user.emailVerification" color="primary"
                >Verified</UBadge
              >
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
                  @click="
                    removeUserFromTeam(user.$id, team.teamId, team.membershipId)
                  "
                />
              </UBadge>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-300">
              {{ user.email || "(anonymous)" }}
            </p>
            <p class="text-sm text-gray-500">
              Created: {{ new Date(user.$createdAt).toLocaleString() }}
            </p>
          </div>
          <UButton
            icon="i-solar-trash-bin-trash-bold-duotone"
            color="error"
            @click="deleteUser(user.$id)"
          />
        </div>
        <div>
          <USelectMenu
            v-model="selectedTeam"
            :items="teams.map((t) => t.$id)"
            placeholder="Add to team"
            class="mt-2"
            @change="addUserToTeam(user.$id, selectedTeam)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
