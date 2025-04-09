import { seedCardsFromJson } from '~/server/utils/seed'
import { createAppwriteClient } from '~/server/utils/appwrite'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { databases } = createAppwriteClient()
  
  const result = await seedCardsFromJson({
    databases,
    databaseId: config.public.appwriteDatabaseId,
    whiteCollection: config.public.appwriteWhiteCardCollectionId,
    blackCollection: config.public.appwriteBlackCardCollectionId
  })

  return result
})