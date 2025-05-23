// noinspection JSUnusedGlobalSymbols

import { seedCardsFromJson } from '~/server/utils/seed'
import { createAppwriteClient } from '~/server/utils/appwrite'
import { readBody, createError } from 'h3'
import Ajv from 'ajv'

// JSON schema for validation
const cardPackSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      pack: { type: 'string' },
      white: {
        type: 'array',
        items: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' }
          }
        }
      },
      black: {
        type: 'array',
        items: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            pick: { type: 'number' }
          }
        }
      }
    }
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { databases } = createAppwriteClient()

  // Set up SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  // Function to send SSE events
  const sendEvent = (eventName: string, data: any) => {
    const response = event.node.res
    response.write(`event: ${eventName}\n`)
    response.write(`data: ${JSON.stringify(data)}\n\n`)
    // Flush the response to ensure the client receives it immediately
    response.flush?.()
  }

  try {
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

    if (!jsonContent) {
      sendEvent('error', { message: 'No JSON content provided' })
      return
    }

    // Validate JSON structure
    try {
      const jsonData = JSON.parse(jsonContent)

      // Validate against schema
      const ajv = new Ajv()
      const validate = ajv.compile(cardPackSchema)
      const valid = validate(jsonData)

      if (!valid) {
        const errors = validate.errors?.map(err => `${err.instancePath} ${err.message}`).join(', ')
        sendEvent('error', { message: `Invalid JSON structure: ${errors}` })
        return
      }

      // Send initial event
      sendEvent('start', { message: 'Starting card seeding process' })

      // Process the cards with progress reporting
      const result = await seedCardsFromJson({
        databases,
        databaseId: config.public.appwriteDatabaseId,
        whiteCollection: config.public.appwriteWhiteCardCollectionId,
        blackCollection: config.public.appwriteBlackCardCollectionId,
        jsonContent,
        onProgress: (progress, stats) => {
          sendEvent('progress', { progress, ...stats })
        }
      })

      // Send completion event
      sendEvent('complete', result)
    } catch (err: any) {
      console.error('JSON parsing error:', err)
      sendEvent('error', { message: `Invalid JSON: ${err.message}` })
    }
  } catch (err: any) {
    console.error('Server error:', err)
    sendEvent('error', { message: `Server error: ${err.message}` })
  }
})
