<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useNotifications } from '~/composables/useNotifications'
import { getAppwrite } from '~/utils/appwrite'

const { notify } = useNotifications()
const config = useRuntimeConfig()

// Form states
const customPackState = reactive({
  packName: '',
  whiteCards: [''],
  blackCards: [{ text: '', pick: 1 }]
})

const uploadState = reactive({
  file: null as File | null,
  fileContent: null as string | null
})

// Other reactive variables
const uploading = ref(false)
const submitting = ref(false)
const showPreview = ref(false)
const previewData = ref<any[]>([])
const previewStats = ref<{ packs: number, whiteCards: number, blackCards: number }>({ 
  packs: 0, 
  whiteCards: 0, 
  blackCards: 0 
})
const uploadProgress = ref(0)
const showProgress = ref(false)

// Validation
const isPackNameValid = computed(() => customPackState.packName.trim().length > 0)
const areWhiteCardsValid = computed(() => customPackState.whiteCards.some(card => card.trim().length > 0))
const areBlackCardsValid = computed(() => customPackState.blackCards.some(card => card.text.trim().length > 0))
const isFormValid = computed(() => isPackNameValid.value && areWhiteCardsValid.value && areBlackCardsValid.value)

const addWhiteCard = () => customPackState.whiteCards.push('')
const addBlackCard = () => customPackState.blackCards.push({ text: '', pick: 1 })
const removeWhiteCard = (i: number) => customPackState.whiteCards.splice(i, 1)
const removeBlackCard = (i: number) => customPackState.blackCards.splice(i, 1)

// Handle file input change
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  uploadState.file = target.files?.[0] || null
}

// Parse JSON file and update preview
const parseJsonFile = async () => {
  if (!uploadState.file) return

  try {
    // Read the file content
    uploadState.fileContent = await uploadState.file.text()

    // Parse the JSON
    const jsonData = JSON.parse(uploadState.fileContent)

    if (!Array.isArray(jsonData)) {
      throw new Error('Invalid JSON format: Expected an array of card packs')
    }

    // Update preview data
    previewData.value = jsonData

    // Calculate statistics
    let totalWhiteCards = 0
    let totalBlackCards = 0

    for (const pack of jsonData) {
      totalWhiteCards += (pack.white?.length || 0)
      totalBlackCards += (pack.black?.length || 0)
    }

    previewStats.value = {
      packs: jsonData.length,
      whiteCards: totalWhiteCards,
      blackCards: totalBlackCards
    }

    // Show preview
    showPreview.value = true

  } catch (err) {
    console.error('Error parsing JSON file:', err)
    notify({
      title: 'Invalid JSON',
      description: 'The selected file contains invalid JSON or has an incorrect format.',
      color: 'error'
    })

    // Reset
    uploadState.fileContent = null
    showPreview.value = false
  }
}

// Watch for file changes
watch(() => uploadState.file, (newFile) => {
  if (newFile) {
    parseJsonFile()
  } else {
    uploadState.fileContent = null
    showPreview.value = false
  }
})

// Submit custom card pack
const submitCustomPack = async () => {
  if (!isFormValid.value) {
    notify({ 
      title: 'Validation Error', 
      description: 'Please fill in all required fields', 
      color: 'warning' 
    })
    return
  }

  submitting.value = true

  try {
    const { databases } = getAppwrite()
    const DB_ID = config.public.appwriteDatabaseId
    const WHITE_COLLECTION = config.public.appwriteWhiteCardCollectionId
    const BLACK_COLLECTION = config.public.appwriteBlackCardCollectionId

    // Filter out empty cards
    const validWhiteCards = customPackState.whiteCards.filter(card => card.trim().length > 0)
    const validBlackCards = customPackState.blackCards.filter(card => card.text.trim().length > 0)

    // Store pack name before resetting
    const createdPackName = customPackState.packName.trim()

    // Create white cards
    for (const cardText of validWhiteCards) {
      await databases.createDocument(
        DB_ID,
        WHITE_COLLECTION,
        "unique()",
        {
          text: cardText.trim(),
          pack: createdPackName,
          active: true,
        }
      )
    }

    // Create black cards
    for (const card of validBlackCards) {
      await databases.createDocument(
        DB_ID,
        BLACK_COLLECTION,
        "unique()",
        {
          text: card.text.trim(),
          pick: card.pick || 1,
          pack: createdPackName,
          active: true,
        }
      )
    }

    // Reset form
    customPackState.packName = ''
    customPackState.whiteCards = ['']
    customPackState.blackCards = [{ text: '', pick: 1 }]

    notify({
      title: 'Pack Created',
      description: `Successfully created pack "${createdPackName}" with ${validWhiteCards.length} white cards and ${validBlackCards.length} black cards`,
      color: 'success'
    })
  } catch (err) {
    console.error('Failed to create pack:', err)
    notify({ 
      title: 'Creation Failed', 
      description: 'Could not create custom card pack', 
      color: 'error' 
    })
  } finally {
    submitting.value = false
  }
}

const uploadJsonFile = async () => {
	if (!uploadState.file || !uploadState.fileContent) {
		notify({ 
			title: 'Upload Error', 
			description: 'No file selected or file content could not be read', 
			color: 'error' 
		})
		return
	}

	uploading.value = true
	showProgress.value = true
	uploadProgress.value = 0

	// Start progress simulation
	const totalCards = previewStats.value.whiteCards + previewStats.value.blackCards
	const simulateProgress = () => {
		// Simulate progress based on the number of cards
		// This is just an estimation since we can't get real-time progress from the server
		const interval = setInterval(() => {
			if (uploadProgress.value < 0.95) {
				// Gradually increase progress, slowing down as we approach 95%
				const increment = (1 - uploadProgress.value) * 0.05
				uploadProgress.value = Math.min(0.95, uploadProgress.value + increment)
			} else if (!uploading.value) {
				// If upload is complete, set to 100%
				uploadProgress.value = 1
				clearInterval(interval)
			}
		}, 200)
		return interval
	}

	const progressInterval = simulateProgress()

	try {
		// Send the file content as JSON
		const res = await fetch('/api/dev/seed', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ file: uploadState.fileContent })
		})

		const result = await res.json()

		// Set progress to 100% when complete
		uploadProgress.value = 1

		// Clear the interval
		clearInterval(progressInterval)

		// Show notification after a short delay to ensure progress bar is seen at 100%
		setTimeout(() => {
			notify({
				title: 'Upload Complete',
				description: result.message || 'Seed complete.',
				color: result.success ? 'success' : 'error'
			})

			// Reset preview after successful upload
			if (result.success) {
				showPreview.value = false
			}

			// Hide progress bar after a delay
			setTimeout(() => {
				showProgress.value = false
			}, 1000)
		}, 500)
	} catch (err) {
		console.error('Upload error:', err)
		clearInterval(progressInterval)
		uploadProgress.value = 0
		showProgress.value = false

		notify({ 
			title: 'Upload Failed', 
			description: 'Could not seed cards', 
			color: 'error' 
		})
	} finally {
		uploading.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<UCard>
			<template #header>
				<h3 class="text-lg font-bold">Create Custom Card Pack</h3>
			</template>

			<UForm :state="customPackState" @submit.prevent="submitCustomPack">
				<UFormField  label="Pack Name" required :error="!isPackNameValid && customPackState.packName !== '' ? 'Pack name is required' : ''">
					<UInput v-model="customPackState.packName" placeholder="e.g. My Cringe Pack" />
				</UFormField >

				<h4 class="mt-4 font-semibold">White Cards <span class="text-xs text-red-500">*</span></h4>
				<div class="space-y-2">
					<div v-for="(card, i) in customPackState.whiteCards" :key="i" class="flex gap-2">
						<UInput 
							v-model="customPackState.whiteCards[i]" 
							class="flex-1" 
							placeholder="Card text" 
							:error="i === 0 && !areWhiteCardsValid && customPackState.whiteCards[0] !== '' ? 'At least one white card is required' : ''"
						/>
						<UButton icon="i-heroicons-trash" color="error" @click="removeWhiteCard(i)" :disabled="customPackState.whiteCards.length === 1" />
					</div>
				</div>
				<UButton variant="outline" size="xs" class="mt-2" @click="addWhiteCard">Add White Card</UButton>

				<h4 class="mt-6 font-semibold">Black Cards <span class="text-xs text-red-500">*</span></h4>
				<div class="space-y-2">
					<div v-for="(card, i) in customPackState.blackCards" :key="i" class="flex gap-2 items-center">
						<UInput 
							v-model="customPackState.blackCards[i].text" 
							class="flex-1" 
							placeholder="Card text" 
							:error="i === 0 && !areBlackCardsValid && customPackState.blackCards[0].text !== '' ? 'At least one black card is required' : ''"
						/>
						<UInput v-model.number="customPackState.blackCards[i].pick" type="number" min="1" max="3" class="w-16" />
						<UButton icon="i-heroicons-trash" color="error" @click="removeBlackCard(i)" :disabled="customPackState.blackCards.length === 1" />
					</div>
				</div>
				<UButton variant="outline" size="xs" class="mt-2" @click="addBlackCard">Add Black Card</UButton>

				<div class="mt-6">
					<UButton type="submit" color="primary" :loading="submitting" :disabled="!isFormValid">
						Create Pack
					</UButton>
				</div>
			</UForm>
		</UCard>

		<UCard>
			<template #header>
				<h3 class="text-2xl font-bold font-['Bebas_Neue']">Upload Pack JSON</h3>
			</template>

			<UForm :state="uploadState">
					<div class="border border-gray-300 rounded p-2 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
						<input 
							type="file" 
							accept=".json" 
							@change="handleFileChange" 
							class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-gray-700 dark:file:text-gray-200"
						/>
					</div>
					<p class="text-xs text-gray-500 mt-1">Upload a JSON file with card packs</p>

				<!-- JSON Preview Section -->
				<div v-if="showPreview" class="mt-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
					<h4 class="font-semibold mb-2">Preview</h4>

					<!-- Summary Stats -->
					<div class="flex gap-4 mb-4">
						<div class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center">
							<div class="text-lg font-bold">{{ previewStats.packs }}</div>
							<div class="text-xs text-gray-500">Packs</div>
						</div>
						<div class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center">
							<div class="text-lg font-bold">{{ previewStats.whiteCards }}</div>
							<div class="text-xs text-gray-500">White Cards</div>
						</div>
						<div class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center">
							<div class="text-lg font-bold">{{ previewStats.blackCards }}</div>
							<div class="text-xs text-gray-500">Black Cards</div>
						</div>
					</div>

					<!-- Pack List -->
					<div class="max-h-60 overflow-y-auto">
						<div v-for="(pack, i) in previewData" :key="i" class="mb-2 p-2 border-b">
							<div class="font-medium">{{ pack.name || `Pack ${pack.pack || i+1}` }}</div>
							<div class="text-xs text-gray-500">
								{{ pack.white?.length || 0 }} white cards, 
								{{ pack.black?.length || 0 }} black cards
							</div>
						</div>
					</div>
				</div>

				<!-- Progress Bar -->
				<div v-if="showProgress" class="mt-4">
					<div class="flex justify-between text-xs text-gray-500 mb-1">
						<span>Seeding cards...</span>
						<span>{{ Math.round(uploadProgress * 100) }}%</span>
					</div>
					<UProgress :value="uploadProgress" color="primary" />
				</div>

				<UButton :loading="uploading" :disabled="!uploadState.file || !uploadState.fileContent" @click="uploadJsonFile" color="primary" class="mt-4">
					Upload & Seed
				</UButton>
			</UForm>
		</UCard>
	</div>
</template>
