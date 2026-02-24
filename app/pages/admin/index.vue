<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});

import { useCardSearch } from "~/composables/useCardSearch";
import { useIsAdmin } from "~/composables/useAdminCheck";

// Gate rendering until admin check resolves
const isAdmin = useIsAdmin();

// For tab navigation - use the shared state from useCardSearch
const { activeTab } = useCardSearch();
</script>

<template>
  <!-- Show nothing until admin status is confirmed — prevents flash of admin content for non-admins -->
  <div v-if="isAdmin" class="p-6 space-y-6 max-w-7xl mx-auto">
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
    >
      <div>
        <h1 class="text-5xl font-bold">Admin Dashboard</h1>
        <p class="text-gray-400 text-xl mt-1">
          Manage cards and monitor game lobbies
        </p>
      </div>
    </div>

    <!-- Tab Navigation for smaller screens -->
    <div class="block lg:hidden mb-6">
      <UTabs
        v-model="activeTab"
        :items="[
          {
            label: 'Card Manager',
            slot: 'cards',
            value: 'cards',
            icon: 'i-solar-documents-bold-duotone',
          },
          {
            label: 'Lobby Monitor',
            slot: 'lobbies',
            value: 'lobbies',
            icon: 'i-solar-clipboard-bold-duotone',
          },
          {
            label: 'User Manager',
            slot: 'users',
            value: 'users',
            icon: 'i-solar-users-group-rounded-bold-duotone',
          },
          {
            label: 'Reports',
            slot: 'reports',
            value: 'reports',
            icon: 'i-solar-flag-bold-duotone',
          },
        ]"
      >
        <template #cards>
          <div
            class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6 rounded-lg"
          >
            <AdminCardManager />
          </div>
        </template>
        <template #lobbies>
          <div
            class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6 rounded-lg"
          >
            <AdminLobbyMonitor />
          </div>
        </template>
        <template #users>
          <div
            class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6 rounded-lg"
          >
            <AdminUserManager />
          </div>
        </template>
        <template #reports>
          <div
            class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6 rounded-lg"
          >
            <AdminReportViewer />
          </div>
        </template>
      </UTabs>
    </div>

    <!-- Desktop Layout -->
    <div class="hidden lg:block columns-1 sm:columns-1 md:columns-2 gap-6">
      <!-- Card Manager -->
      <UCard
        class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-semibold">Card Manager</h2>
            <UBadge
              icon="i-solar-info-square-bold-duotone"
              size="md"
              color="info"
              variant="solid"
              >Manage game cards - add, search, edit, delete, or toggle active
              status</UBadge
            >
          </div>
        </template>
        <AdminCardManager />
      </UCard>

      <!-- Lobby Monitor -->
      <UCard
        class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-semibold">Active Lobbies</h2>
            <UBadge
              icon="i-solar-info-square-bold-duotone"
              size="md"
              color="info"
              variant="solid"
              >Monitor active game lobbies and players</UBadge
            >
          </div>
        </template>
        <AdminLobbyMonitor />
      </UCard>

      <!-- User Manager -->
      <UCard
        class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-semibold">Users Manager</h2>
            <UBadge
              icon="i-solar-info-square-bold-duotone"
              size="md"
              color="info"
              variant="solid"
              >Manage Authenticated Users</UBadge
            >
          </div>
        </template>
        <AdminUserManager />
      </UCard>

      <!-- Report Viewer -->
      <UCard
        class="h-fit outline-2 outline-dashed outline-gray-300/25 outline-offset-4 break-inside-avoid mb-6"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-semibold">Reports</h2>
            <UBadge
              icon="i-solar-info-square-bold-duotone"
              size="md"
              color="info"
              variant="solid"
              >View and manage reported cards</UBadge
            >
          </div>
        </template>
        <AdminReportViewer />
      </UCard>
    </div>
  </div>
</template>
