<script setup lang="ts">
import { useUserStore } from "~/stores/userStore";
import { useNotifications } from "~/composables/useNotifications";

const userStore = useUserStore();
const { notify } = useNotifications();

const reports = ref<any[]>([]);
const loading = ref(true);
const dismissingId = ref<string | null>(null);
const expandedId = ref<string | null>(null);

// Inline edit state
const editingReportId = ref<string | null>(null);
const editText = ref("");
const savingEdit = ref(false);
const togglingId = ref<string | null>(null);
const deletingCardId = ref<string | null>(null);

// Auth header helper
const authHeaders = () => ({
  Authorization: `Bearer ${userStore.session?.$id}`,
  "x-appwrite-user-id": userStore.user?.$id ?? "",
});

// Fetch reports from the API
const fetchReports = async () => {
  loading.value = true;
  try {
    const res = await $fetch("/api/admin/reports", {
      headers: authHeaders(),
    });
    reports.value = res.reports || [];
  } catch (error) {
    console.error("Error fetching reports:", error);
    notify({
      title: "Error",
      description: "Failed to fetch reports",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Toggle expanded row
const toggleExpand = (reportId: string) => {
  expandedId.value = expandedId.value === reportId ? null : reportId;
  // Reset edit state when collapsing
  if (expandedId.value !== reportId) {
    editingReportId.value = null;
  }
};

// ─── Inline Card Actions ────────────────────────────────────────────

const startEdit = (report: any) => {
  editingReportId.value = report.$id;
  editText.value = report.cardText || "";
};

const cancelEdit = () => {
  editingReportId.value = null;
  editText.value = "";
};

const saveEdit = async (report: any) => {
  if (!editText.value.trim()) return;
  savingEdit.value = true;
  try {
    await $fetch("/api/admin/reports/card-action", {
      method: "POST",
      headers: authHeaders(),
      body: {
        action: "edit",
        cardId: report.cardId,
        cardType: report.cardType,
        text: editText.value,
      },
    });
    // Update local data
    report.cardText = editText.value.trim();
    editingReportId.value = null;
    notify({
      title: "Card Updated",
      description: "Card text saved.",
      color: "success",
    });
  } catch (error) {
    console.error("Error editing card:", error);
    notify({
      title: "Error",
      description: "Failed to update card",
      color: "error",
    });
  } finally {
    savingEdit.value = false;
  }
};

const toggleCardActive = async (report: any) => {
  togglingId.value = report.$id;
  try {
    const res = await $fetch("/api/admin/reports/card-action", {
      method: "POST",
      headers: authHeaders(),
      body: {
        action: "toggle",
        cardId: report.cardId,
        cardType: report.cardType,
      },
    });
    report.cardActive = (res as any).card?.active ?? !report.cardActive;
    notify({
      title: report.cardActive ? "Card Activated" : "Card Deactivated",
      description: report.cardActive
        ? "Card is now in rotation."
        : "Card removed from rotation.",
      color: "success",
    });
  } catch (error) {
    console.error("Error toggling card:", error);
    notify({
      title: "Error",
      description: "Failed to toggle card status",
      color: "error",
    });
  } finally {
    togglingId.value = null;
  }
};

const deleteCard = async (report: any) => {
  deletingCardId.value = report.$id;
  try {
    await $fetch("/api/admin/reports/card-action", {
      method: "POST",
      headers: authHeaders(),
      body: {
        action: "delete",
        cardId: report.cardId,
        cardType: report.cardType,
      },
    });
    report.cardText = null;
    report.cardActive = null;
    report.cardPack = null;
    notify({
      title: "Card Deleted",
      description: "The card has been permanently removed.",
      color: "success",
    });
  } catch (error) {
    console.error("Error deleting card:", error);
    notify({
      title: "Error",
      description: "Failed to delete card",
      color: "error",
    });
  } finally {
    deletingCardId.value = null;
  }
};

// ─── Report Actions ─────────────────────────────────────────────────

const dismissReport = async (reportId: string) => {
  dismissingId.value = reportId;
  try {
    await $fetch("/api/admin/reports/dismiss", {
      method: "POST",
      headers: authHeaders(),
      body: { reportId },
    });
    reports.value = reports.value.filter((r) => r.$id !== reportId);
    if (expandedId.value === reportId) expandedId.value = null;
    notify({
      title: "Report Dismissed",
      description: "The report has been removed.",
      color: "success",
    });
  } catch (error) {
    console.error("Error dismissing report:", error);
    notify({
      title: "Error",
      description: "Failed to dismiss report",
      color: "error",
    });
  } finally {
    dismissingId.value = null;
  }
};

const dismissAll = async () => {
  if (!reports.value.length) return;
  const ids = [...reports.value.map((r) => r.$id)];
  for (const id of ids) {
    await dismissReport(id);
  }
};

// ─── Helpers ────────────────────────────────────────────────────────

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const reasonMeta = (reason: string) => {
  const lower = reason.toLowerCase();
  if (lower.includes("spelling") || lower.includes("grammar"))
    return {
      icon: "i-solar-text-bold-duotone",
      color: "text-amber-400",
      label: "Spelling",
    };
  if (lower.includes("duplicate"))
    return {
      icon: "i-solar-copy-bold-duotone",
      color: "text-blue-400",
      label: "Duplicate",
    };
  if (lower.includes("inappropriate"))
    return {
      icon: "i-solar-danger-triangle-bold-duotone",
      color: "text-red-400",
      label: "Inappropriate",
    };
  return {
    icon: "i-solar-chat-round-dots-bold-duotone",
    color: "text-gray-400",
    label: "Other",
  };
};

onMounted(fetchReports);
</script>

<template>
  <div>
    <!-- Header stats bar -->
    <div v-if="!loading" class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <UBadge
          v-if="reports.length"
          color="warning"
          variant="subtle"
          size="lg"
        >
          {{ reports.length }} pending
        </UBadge>
        <UBadge v-else color="success" variant="subtle" size="lg">
          All clear
        </UBadge>
      </div>
      <div class="flex gap-2">
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-solar-refresh-bold-duotone"
          :loading="loading"
          @click="fetchReports"
        >
          Refresh
        </UButton>
        <UButton
          v-if="reports.length > 1"
          size="sm"
          color="error"
          variant="soft"
          icon="i-solar-trash-bin-trash-bold-duotone"
          @click="dismissAll"
        >
          Dismiss All
        </UButton>
      </div>
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="report-skeleton rounded-xl p-4">
        <div class="flex items-start gap-4">
          <USkeleton class="h-16 w-12 rounded-lg shrink-0" />
          <div class="flex-1 space-y-2">
            <USkeleton class="h-4 w-3/4" />
            <USkeleton class="h-3 w-1/2" />
            <USkeleton class="h-3 w-1/3" />
          </div>
          <USkeleton class="h-8 w-8 rounded-lg shrink-0" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="reports.length === 0"
      class="report-empty text-center py-12"
    >
      <div
        class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4"
      >
        <UIcon
          name="i-solar-check-circle-bold-duotone"
          class="text-4xl text-green-400"
        />
      </div>
      <h3 class="text-lg font-semibold text-gray-200">No Reports</h3>
      <p class="text-sm text-gray-500 mt-1">
        There are no reported cards at this time.
      </p>
    </div>

    <!-- Report list -->
    <TransitionGroup v-else name="report-list" tag="div" class="space-y-3">
      <div
        v-for="report in reports"
        :key="report.$id"
        class="report-item rounded-xl overflow-hidden transition-all duration-300"
        :class="{ 'report-item--expanded': expandedId === report.$id }"
      >
        <!-- Main row -->
        <div
          class="report-row flex items-start gap-3 p-4 cursor-pointer"
          @click="toggleExpand(report.$id)"
        >
          <!-- Card mini-preview -->
          <div
            class="report-card-chip shrink-0 w-11 h-16 rounded-lg flex items-center justify-center text-[0.55rem] leading-tight p-1.5 font-medium overflow-hidden"
            :class="
              report.cardType === 'black'
                ? 'bg-gray-950 text-white border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-300'
            "
          >
            <span class="line-clamp-4 text-center">
              {{ report.cardText || "???" }}
            </span>
          </div>

          <!-- Report info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <UIcon
                :name="reasonMeta(report.reason).icon"
                :class="reasonMeta(report.reason).color"
                class="text-lg shrink-0"
              />
              <span class="font-medium text-sm text-gray-100 truncate">
                {{ report.reason }}
              </span>
            </div>

            <!-- Card text preview -->
            <p
              v-if="report.cardText"
              class="text-xs text-gray-400 mt-1 truncate"
            >
              "{{ report.cardText }}"
            </p>
            <p v-else class="text-xs text-red-400/70 mt-1 italic">
              Card deleted or not found
            </p>

            <div class="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span>{{ formatDate(report.$createdAt) }}</span>
              <UBadge
                :color="report.cardType === 'black' ? 'neutral' : 'white'"
                variant="subtle"
                size="xs"
              >
                {{ report.cardType }}
              </UBadge>
              <UBadge
                v-if="report.cardPack"
                color="info"
                variant="subtle"
                size="xs"
              >
                {{ report.cardPack }}
              </UBadge>
            </div>
          </div>

          <!-- Expand / collapse chevron -->
          <UIcon
            name="i-solar-alt-arrow-down-line-duotone"
            class="text-gray-500 text-lg shrink-0 transition-transform duration-300"
            :class="{ 'rotate-180': expandedId === report.$id }"
          />
        </div>

        <!-- Expanded details -->
        <Transition name="expand">
          <div
            v-if="expandedId === report.$id"
            class="report-details px-4 pb-4"
          >
            <div class="border-t border-gray-700/50 pt-3 space-y-3">
              <!-- Full card preview / editor -->
              <div v-if="report.cardText">
                <!-- Editing mode -->
                <div v-if="editingReportId === report.$id" class="space-y-2">
                  <UTextarea
                    v-model="editText"
                    autoresize
                    class="w-full"
                    placeholder="Card text"
                  />
                  <div class="flex gap-2">
                    <UButton
                      size="xs"
                      color="primary"
                      icon="i-solar-check-read-bold-duotone"
                      :loading="savingEdit"
                      @click.stop="saveEdit(report)"
                    >
                      Save
                    </UButton>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click.stop="cancelEdit"
                    >
                      Cancel
                    </UButton>
                  </div>
                </div>

                <!-- Display mode -->
                <div
                  v-else
                  class="report-card-preview rounded-lg p-4 text-sm"
                  :class="
                    report.cardType === 'black'
                      ? 'bg-gray-950 text-white border border-gray-700'
                      : 'bg-white text-gray-900 border border-gray-200'
                  "
                >
                  <p class="font-medium whitespace-pre-wrap">
                    {{ report.cardText }}
                  </p>
                  <div class="flex items-center gap-2 mt-3 text-xs opacity-60">
                    <span v-if="report.cardPack"
                      >Pack: {{ report.cardPack }}</span
                    >
                    <span v-if="report.cardActive !== null">
                      · {{ report.cardActive ? "Active" : "Inactive" }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Card deleted state -->
              <div
                v-else
                class="rounded-lg p-4 text-sm bg-red-950/30 border border-red-900/30 text-red-300 italic"
              >
                This card has already been deleted.
              </div>

              <!-- Report metadata -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-gray-500">Card ID</span>
                  <p class="font-mono text-gray-300 truncate">
                    {{ report.cardId }}
                  </p>
                </div>
                <div>
                  <span class="text-gray-500">Reported By</span>
                  <p class="font-mono text-gray-300 truncate">
                    {{ report.reportedBy }}
                  </p>
                </div>
                <div class="col-span-2">
                  <span class="text-gray-500">Date</span>
                  <p class="text-gray-300">
                    {{ new Date(report.$createdAt).toLocaleString() }}
                  </p>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center flex-wrap gap-2 pt-1">
                <!-- Card actions (only if card still exists) -->
                <template v-if="report.cardText">
                  <UButton
                    size="sm"
                    color="primary"
                    variant="soft"
                    icon="i-solar-pen-bold-duotone"
                    @click.stop="startEdit(report)"
                  >
                    Edit Card
                  </UButton>
                  <UButton
                    size="sm"
                    :color="report.cardActive ? 'warning' : 'success'"
                    variant="soft"
                    :icon="
                      report.cardActive
                        ? 'i-solar-eye-closed-bold-duotone'
                        : 'i-solar-eye-bold-duotone'
                    "
                    :loading="togglingId === report.$id"
                    @click.stop="toggleCardActive(report)"
                  >
                    {{ report.cardActive ? "Deactivate" : "Activate" }}
                  </UButton>
                  <UButton
                    size="sm"
                    color="error"
                    variant="soft"
                    icon="i-solar-trash-bin-trash-bold-duotone"
                    :loading="deletingCardId === report.$id"
                    @click.stop="deleteCard(report)"
                  >
                    Delete Card
                  </UButton>
                </template>

                <!-- Divider if card actions are present -->
                <div v-if="report.cardText" class="w-px h-5 bg-gray-700 mx-1" />

                <!-- Dismiss report -->
                <UButton
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-solar-close-circle-bold-duotone"
                  :loading="dismissingId === report.$id"
                  @click.stop="dismissReport(report.$id)"
                >
                  Dismiss Report
                </UButton>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.report-skeleton {
  background: rgba(51, 65, 85, 0.4);
}

.report-item {
  background: rgba(51, 65, 85, 0.35);
  border: 1px solid rgba(100, 116, 139, 0.15);
  transition:
    background 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.report-item:hover {
  background: rgba(51, 65, 85, 0.5);
  border-color: rgba(100, 116, 139, 0.3);
}

.report-item--expanded {
  background: rgba(51, 65, 85, 0.55);
  border-color: rgba(100, 116, 139, 0.35);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.report-card-chip {
  transition: transform 0.2s;
}

.report-item:hover .report-card-chip {
  transform: scale(1.05);
}

/* List transition animations */
.report-list-enter-active,
.report-list-leave-active {
  transition: all 0.4s ease;
}

.report-list-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.report-list-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.report-list-move {
  transition: transform 0.4s ease;
}

/* Expand/collapse animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
