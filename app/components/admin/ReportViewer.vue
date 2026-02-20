<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '~/stores/userStore'
import { useNotifications } from '~/composables/useNotifications'
import { useCardSearch } from '~/composables/useCardSearch'

const userStore = useUserStore()
const { notify } = useNotifications()
const { setSearchParams } = useCardSearch()
const reports = ref<any[]>([])
const loading = ref(true)
const selectedReport = ref<any>(null)
const showCardDetails = ref(false)

// Fetch reports from the API
const fetchReports = async () => {
  loading.value = true
  try {
    const res = await $fetch('/api/admin/reports', {
      headers: { Authorization: `Bearer ${userStore.session?.$id}` },
      navigate: false
    })
    reports.value = res.reports
  } catch (error) {
    console.error('Error fetching reports:', error)
    notify({
      title: 'Error',
      description: 'Failed to fetch reports',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// View card details
const viewCardDetails = (report: any) => {
  selectedReport.value = report
  showCardDetails.value = true
}

// Navigate to card in CardManager
const goToCardManager = () => {
  if (!selectedReport.value) return

  // Set the search parameters in the shared state
  setSearchParams(selectedReport.value.cardId, selectedReport.value.cardType)

  // Close the modal
  showCardDetails.value = false

  notify({
    title: 'Navigating',
    description: 'Searching for card in Card Manager',
    color: 'info'
  })
}

// Dismiss report
const dismissReport = async (reportId: string) => {
  try {
    // In a real implementation, you would call an API to update the report status
    // For now, we'll just remove it from the local list
    reports.value = reports.value.filter(report => report.$id !== reportId)
    showCardDetails.value = false
    selectedReport.value = null
    notify({
      title: 'Success',
	    description: 'Report dismissed',
      color: 'success'
    })
  } catch (error) {
    console.error('Error dismissing report:', error)
    notify({
      title: 'Error',
	    description: 'Failed to dismiss report',
      color: 'error'
    })
  }
}

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}

onMounted(fetchReports)
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-3">
      <!-- Skeleton cards -->
      <div v-for="i in 5" :key="i" class="bg-slate-700 rounded p-4 flex justify-between items-center relative">
        <div class="max-w-xl mb-4 w-full">
          <USkeleton class="h-5 w-full" />
          <USkeleton class="h-5 w-3/4 mt-2" />
        </div>
        <div class="flex gap-2 absolute left-0 bottom-0 m-2">
          <span class="ml-2 flex items-center">
            <USkeleton class="h-4 w-20" />
          </span>
        </div>
        <div class="flex items-center gap-1">
          <USkeleton class="h-8 w-8 rounded" />
        </div>
      </div>
    </div>

    <div v-else-if="reports.length === 0" class="text-center py-8">
      <UIcon name="i-solar-check-circle-bold-duotone" class="text-5xl text-green-500 mb-2" />
      <h3 class="text-xl font-semibold">No Reports</h3>
      <p class="text-gray-400">There are no reported cards at this time.</p>
    </div>

    <ul v-else class="space-y-4">
      <li v-for="report in reports" :key="report.$id" class="bg-slate-700 p-4 rounded text-white cursor-default">
        <div class="flex justify-between items-center">
          <div @click.stop>
            <div class="flex items-center gap-2">
              <UBadge :class="report.cardType === 'black' ? 'bg-black text-white' : 'bg-white text-black'" class="text-sm">
                {{ report.cardType === 'black' ? 'Black Card' : 'White Card' }}
              </UBadge>
              <span class="text-gray-300 text-sm">Reported: {{ formatDate(report.$createdAt) }}</span>
            </div>
            <p class="mt-2 font-medium">Reason: {{ report.reason }}</p>
          </div>
          <UButton icon="i-solar-eye-bold-duotone" color="primary" @click.stop="viewCardDetails(report)">
            View
          </UButton>
        </div>
      </li>
    </ul>

    <!-- Card Details Modal -->
    <UModal v-model="showCardDetails" :ui="{ width: 'sm:max-w-xl' }">
      <UCard v-if="selectedReport">
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-semibold">Reported Card</h3>
            <UBadge :class="selectedReport.cardType === 'black' ? 'bg-black text-white' : 'bg-white text-black'" class="text-sm">
              {{ selectedReport.cardType === 'black' ? 'Black Card' : 'White Card' }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <div>
            <h4 class="text-sm font-medium text-gray-500">Card ID</h4>
            <p class="font-mono text-sm">{{ selectedReport.cardId }}</p>
          </div>

          <div>
            <h4 class="text-sm font-medium text-gray-500">Report Reason</h4>
            <p>{{ selectedReport.reason }}</p>
          </div>

          <div>
            <h4 class="text-sm font-medium text-gray-500">Reported By</h4>
            <p class="font-mono text-sm">{{ selectedReport.reportedBy }}</p>
          </div>

          <div>
            <h4 class="text-sm font-medium text-gray-500">Reported On</h4>
            <p>{{ formatDate(selectedReport.$createdAt) }}</p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-between">
            <UButton color="neutral" @click="showCardDetails = false">
              Close
            </UButton>
            <div class="flex gap-2">
              <UButton color="primary" @click="goToCardManager">
                Find in Card Manager
              </UButton>
              <UButton color="error" @click="dismissReport(selectedReport.$id)">
                Dismiss Report
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<style scoped>
/* No additional styles needed */
</style>
