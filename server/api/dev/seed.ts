// noinspection JSUnusedGlobalSymbols

import {seedCardsFromJson} from '~/server/utils/seed'
import {createAppwriteClient} from '~/server/utils/appwrite'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const { databases } = createAppwriteClient()

  return await seedCardsFromJson({
    databases,
    databaseId: config.public.appwriteDatabaseId,
    whiteCollection: config.public.appwriteWhiteCardCollectionId,
    blackCollection: config.public.appwriteBlackCardCollectionId
  })
})