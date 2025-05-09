// noinspection JSUnusedGlobalSymbols

import { seedCardsFromJson } from '~/server/utils/seed'
import { createAppwriteClient } from '~/server/utils/appwrite'
import { readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { databases } = createAppwriteClient()

  // Handle file upload from form
  const formData = await readBody(event)
  let jsonContent = null

  if (formData && formData.file) {
    // Get the file content from the form data
    const fileContent = formData.file
    if (typeof fileContent === 'string') {
      jsonContent = fileContent
    }
  }

  return await seedCardsFromJson({
    databases,
    databaseId: config.public.appwriteDatabaseId,
    whiteCollection: config.public.appwriteWhiteCardCollectionId,
    blackCollection: config.public.appwriteBlackCardCollectionId,
    jsonContent
  })
})
