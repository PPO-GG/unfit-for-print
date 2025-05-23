// server/utils/progressEmitter.ts
import { EventEmitter } from 'events'

// Create a singleton event emitter to share progress information across endpoints
const progressEmitter = new EventEmitter()

// Set a higher limit for event listeners to avoid warnings
progressEmitter.setMaxListeners(100)

// Store progress data for each session
const progressData = new Map<string, any>()

// Function to emit progress events
export const emitProgress = (sessionId: string, eventName: string, data: any) => {
  // Store the latest progress data for this session
  if (!progressData.has(sessionId)) {
    progressData.set(sessionId, {})
  }
  
  const sessionData = progressData.get(sessionId)
  progressData.set(sessionId, { ...sessionData, ...data })
  
  // Emit the event with the session ID and data
  progressEmitter.emit(`${sessionId}:${eventName}`, data)
}

// Function to listen for progress events
export const onProgress = (sessionId: string, eventName: string, callback: (data: any) => void) => {
  const eventKey = `${sessionId}:${eventName}`
  
  // Add the event listener
  progressEmitter.on(eventKey, callback)
  
  // Return a function to remove the listener
  return () => {
    progressEmitter.off(eventKey, callback)
  }
}

// Function to get the latest progress data for a session
export const getProgressData = (sessionId: string) => {
  return progressData.get(sessionId) || {}
}

// Function to clean up progress data for a session
export const cleanupProgressData = (sessionId: string) => {
  progressData.delete(sessionId)
}

export default {
  emitProgress,
  onProgress,
  getProgressData,
  cleanupProgressData
}