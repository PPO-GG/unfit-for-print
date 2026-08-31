<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { TableColumn } from "@nuxt/ui";
import { getPaginationRowModel, type SortingState } from "@tanstack/vue-table";
import { useUserStore } from "~/stores/userStore";

const userStore = useUserStore();
const { confirm } = useConfirm();

const users = ref<any[]>([]);
const loading = ref(true);
const pagination = ref({ pageIndex: 0, pageSize: 10 });
const sorting = ref<SortingState>([
  { id: "createdAt", desc: true },
]);

const userCount = computed(() => users.value.length);

const setPage = (page: number) => {
  pagination.value = { ...pagination.value, pageIndex: page - 1 };
};

const columns: TableColumn<any>[] = [
  { accessorKey: "avatarUrl", header: "", enableSorting: false },
  { accessorKey: "name", header: "Username", enableSorting: true },
  {
    accessorKey: "createdAt",
    header: "Registered",
    enableSorting: true,
    sortingFn: "datetime",
  },
  { accessorKey: "isAdmin", header: "Admin", enableSorting: true },
  { id: "remove", header: "", enableSorting: false },
];

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

const toggleAdmin = async (user: any) => {
  const nextIsAdmin = !user.isAdmin;
  const confirmed = await confirm({
    title: nextIsAdmin ? "Grant Admin" : "Revoke Admin",
    message: nextIsAdmin
      ? `Make "${user.name || "Unnamed User"}" an admin?`
      : `Remove admin access from "${user.name || "Unnamed User"}"?`,
    confirmButtonText: nextIsAdmin ? "Grant" : "Revoke",
    confirmButtonColor: nextIsAdmin ? "primary" : "error",
  });
  if (!confirmed) return;

  try {
    await $fetch("/api/admin/users/toggle-admin", {
      method: "POST",
      body: { userId: user.id, isAdmin: nextIsAdmin },
    });
    user.isAdmin = nextIsAdmin;
  } catch (err) {
    console.error("Toggle admin request failed:", err);
  }
};

onMounted(async () => {
  try {
    // Ensure user session is initialized before making admin API requests
    if (!userStore.isLoggedIn) {
      await userStore.fetchSession();
    }

    if (!userStore.isLoggedIn) {
      console.error("UserManager: No session available after initialization");
      loading.value = false;
      return;
    }

    try {
      const res = await $fetch("/api/admin/users");
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
  <div class="space-y-3">
    <div class="flex items-center gap-2 text-slate-300">
      <UIcon name="i-solar-users-group-rounded-bold-duotone" class="text-xl" />
      <USkeleton v-if="loading" class="h-5 w-32" />
      <span v-else>{{ userCount }} user{{ userCount === 1 ? "" : "s" }} registered</span>
    </div>

    <UTable
      v-model:pagination="pagination"
      v-model:sorting="sorting"
      :data="users"
      :columns="columns"
      :loading="loading"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      class="text-white"
    >
      <template #name-header="{ column }">
        <UButton
          color="neutral"
          variant="ghost"
          label="Username"
          :icon="
            column.getIsSorted()
              ? column.getIsSorted() === 'asc'
                ? 'i-lucide-arrow-up-narrow-wide'
                : 'i-lucide-arrow-down-wide-narrow'
              : 'i-lucide-arrow-up-down'
          "
          class="-mx-2.5 font-semibold text-slate-300"
          @click="column.toggleSorting(column.getIsSorted() === 'asc')"
        />
      </template>

      <template #createdAt-header="{ column }">
        <UButton
          color="neutral"
          variant="ghost"
          label="Registered"
          :icon="
            column.getIsSorted()
              ? column.getIsSorted() === 'asc'
                ? 'i-lucide-arrow-up-narrow-wide'
                : 'i-lucide-arrow-down-wide-narrow'
              : 'i-lucide-arrow-up-down'
          "
          class="-mx-2.5 font-semibold text-slate-300"
          @click="column.toggleSorting(column.getIsSorted() === 'asc')"
        />
      </template>

      <template #isAdmin-header="{ column }">
        <UButton
          color="neutral"
          variant="ghost"
          label="Admin"
          :icon="
            column.getIsSorted()
              ? column.getIsSorted() === 'asc'
                ? 'i-lucide-arrow-up-narrow-wide'
                : 'i-lucide-arrow-down-wide-narrow'
              : 'i-lucide-arrow-up-down'
          "
          class="-mx-2.5 font-semibold text-slate-300"
          @click="column.toggleSorting(column.getIsSorted() === 'asc')"
        />
      </template>

      <template #avatarUrl-cell="{ row }">
        <UAvatar :src="row.original.avatarUrl" :alt="row.original.name" size="md" />
      </template>

      <template #name-cell="{ row }">
        <div class="flex items-center gap-2">
          <span>{{ row.original.name || "Unnamed User" }}</span>
          <UBadge v-if="row.original.isGuest" color="neutral">Guest</UBadge>
        </div>
      </template>

      <template #createdAt-cell="{ row }">
        {{ new Date(row.original.createdAt).toLocaleString() }}
      </template>

      <template #isAdmin-cell="{ row }">
        <div class="flex items-center gap-2">
          <UBadge v-if="row.original.isAdmin" color="primary">Admin</UBadge>
          <UButton
            :icon="row.original.isAdmin ? 'i-solar-shield-minus-bold-duotone' : 'i-solar-shield-plus-bold-duotone'"
            :color="row.original.isAdmin ? 'neutral' : 'primary'"
            :disabled="row.original.isAdmin && row.original.id === userStore.user?.id"
            :title="row.original.isAdmin ? 'Revoke admin' : 'Grant admin'"
            variant="ghost"
            @click="toggleAdmin(row.original)"
          />
        </div>
      </template>

      <template #remove-cell="{ row }">
        <UButton
          icon="i-solar-trash-bin-trash-bold-duotone"
          color="error"
          variant="ghost"
          @click="deleteUser(row.original.id)"
        />
      </template>
    </UTable>

    <div v-if="userCount > pagination.pageSize" class="flex justify-center pt-2">
      <UPagination
        :page="pagination.pageIndex + 1"
        :items-per-page="pagination.pageSize"
        :total="userCount"
        @update:page="setPage"
      />
    </div>
  </div>
</template>

