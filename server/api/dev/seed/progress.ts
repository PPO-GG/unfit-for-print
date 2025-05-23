// server/api/dev/seed/progress.ts
import { createError } from 'h3'
import { onProgress, getProgressData, cleanupProgressData } from '~/server/utils/progressEmitter'

export default defineEventHandler(async (event) => {
  // Only allow GET requests for SSE
  if (event.node.req.method !== 'GET') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
      message: 'Only GET requests are allowed for SSE connections'
    })
  }

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

  // Get session ID from query parameters
  const query = getQuery(event)
  const sessionId = query.sessionId as string

  if (!sessionId) {
    sendEvent('error', { message: 'No session ID provided' })
    return
  }

  // Send initial connection event
  sendEvent('start', { message: 'SSE connection established. Monitoring progress...' })

  // Check if there's any existing progress data for this session
  const existingData = getProgressData(sessionId)
  if (Object.keys(existingData).length > 0) {
    // Send the existing progress data
    sendEvent('progress', existingData)
  }

  // Set up event listeners for this session
  const removeStartListener = onProgress(sessionId, 'start', (data) => {
    sendEvent('start', data)
  })

  const removeProgressListener = onProgress(sessionId, 'progress', (data) => {
    sendEvent('progress', data)
  })

  const removeCompleteListener = onProgress(sessionId, 'complete', (data) => {
    sendEvent('complete', data)
    // Clean up progress data when complete
    cleanupProgressData(sessionId)
  })

  const removeErrorListener = onProgress(sessionId, 'error', (data) => {
    sendEvent('error', data)
  })

  // Handle client disconnect
  event.node.req.on('close', () => {
    // Remove event listeners when the client disconnects
    removeStartListener()
    removeProgressListener()
    removeCompleteListener()
    removeErrorListener()
    console.log(`Client disconnected from progress stream for session ${sessionId}`)
  })

  // Keep the connection open
  await new Promise<void>((resolve) => {
    // This promise never resolves, keeping the connection open
    // The client will close the connection when done
    event.node.req.on('close', () => {
      resolve()
    })
  })
})
