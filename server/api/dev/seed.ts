// noinspection JSUnusedGlobalSymbols

import { seedCardsFromJson } from '~/server/utils/seed'
import { createAppwriteClient } from '~/server/utils/appwrite'
import { readBody, createError } from 'h3'
import Ajv from 'ajv'
import { emitProgress } from '~/server/utils/progressEmitter'

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
  const method = event.node.req.method || 'GET'

  // Only allow POST requests for data submission
  if (method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
      message: 'Only POST requests are allowed for data submission'
    })
  }

  // Set regular JSON response headers
  setResponseHeaders(event, {
    'Content-Type': 'application/json'
  })

  try {
    // Handle file upload from form
    const formData = await readBody(event)
    let jsonContent = null
    let sessionId = null

    if (formData) {
      // Get the file content from the form data
      if (formData.file && typeof formData.file === 'string') {
        jsonContent = formData.file
      }

      // Get the session ID if provided
      if (formData.sessionId && typeof formData.sessionId === 'string') {
        sessionId = formData.sessionId
      }
    }

    // Generate a session ID if not provided
    if (!sessionId) {
      sessionId = Date.now().toString()
    }

    if (!jsonContent) {
      return { 
        message: 'No JSON content provided',
        status: 'error'
      }
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
        return {
          message: `Invalid JSON structure: ${errors}`,
          status: 'error'
        }
      }

      // Emit initial progress event
      emitProgress(sessionId, 'start', { message: 'Starting card seeding process' })

      // Process the cards with progress reporting
      // This will be handled asynchronously, and progress will be reported via the progress endpoint
      // Start the processing in a separate "thread" so we can return a response immediately
      const processingPromise = seedCardsFromJson({
        databases,
        databaseId: config.public.appwriteDatabaseId,
        whiteCollection: config.public.appwriteWhiteCardCollectionId,
        blackCollection: config.public.appwriteBlackCardCollectionId,
        jsonContent,
        onProgress: (progress, stats) => {
          // Emit progress event with session ID
          emitProgress(sessionId, 'progress', { progress, ...stats })
          console.log(`Processing progress: ${Math.round(progress * 100)}%`)
        }
      })

      // Don't await the promise, let it run in the background
      processingPromise.then(result => {
        // Emit completion event
        emitProgress(sessionId, 'complete', result)
        console.log('Card seeding completed successfully')
      }).catch(err => {
        // Emit error event
        emitProgress(sessionId, 'error', { 
          message: err.message || 'Error during card seeding',
          resumePosition: err.resumePosition
        })
        console.error('Error during card seeding:', err)
      })

      // Return a success response immediately
      return { 
        message: 'Card seeding started successfully',
        status: 'processing',
        sessionId // Include the session ID in the response
      }
    } catch (err: any) {
      console.error('JSON parsing error:', err)
      return {
        message: `Invalid JSON: ${err.message}`,
        status: 'error'
      }
    }
  } catch (err: any) {
    console.error('Server error:', err)
    return {
      message: `Server error: ${err.message}`,
      status: 'error'
    }
  }
})
