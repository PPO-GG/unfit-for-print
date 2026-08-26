<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useUserStore } from "~/stores/userStore";

const userStore = useUserStore();
const { confirm } = useConfirm();

// Auth header helper
const authHeaders = () => ({
  Authorization: `Bearer ${userStore.session?.$id}`,
  "x-appwrite-user-id": userStore.user?.$id ?? "",
});

const users = ref<any[]>([]);
const loading = ref(true);

const deleteUser = async (userId: string) => {
  const confirmed = await confirm({
    title: "Delete User",
    message: "Are you sure you want to delete this user?",
    confirmButtonText: "Delete",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;

  try {
    const res = await $fetch("/api/admin/users/delete", {
      headers: authHeaders(),
      navigate: false,
      method: "POST",
      body: { userId },
    });
    if (res.success) {
      users.value = users.value.filter((u) => u.id !== userId);
    } else {
      console.error("Delete failed:", (res as any).message);
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
      users.value = res;
    } catch (apiErr) {
      console.error("UserManager: API request failed:", apiErr);
    }
  } catch (err) {
    console.error("UserManager: Failed to fetch users:", err);
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
        :key="user.id"
        class="bg-slate-700 p-4 rounded text-white space-y-2"
      >
        <div class="flex justify-between items-center">
          <div class="flex gap-4 items-center flex-wrap">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ user.name || "Unnamed User" }}</span>
              <UBadge v-if="user.isAdmin" color="primary">Admin</UBadge>
              <UBadge v-if="user.isGuest" color="neutral">Guest</UBadge>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-500">
              Created: {{ new Date(user.createdAt).toLocaleString() }}
            </p>
          </div>
          <UButton
            icon="i-solar-trash-bin-trash-bold-duotone"
            color="error"
            @click="deleteUser(user.id)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
