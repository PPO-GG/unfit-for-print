// server/api/dev/seed/progress.ts
import { createError, createEventStream } from "h3";

export default defineEventHandler(async (event) => {
  // Only allow GET requests for SSE
  if (event.node.req.method !== "GET") {
    throw createError({
      statusCode: 405,
      statusMessage: "Method Not Allowed",
      message: "Only GET requests are allowed for SSE connections",
    });
  }

  // Get session ID from query parameters
  const query = getQuery(event);
  const sessionId = query.sessionId as string;

  // Create the SSE event stream (handles headers, flushing, and keepalive)
  const eventStream = createEventStream(event);

  // Helper to push typed SSE events
  const sendEvent = async (eventName: string, data: any) => {
    await eventStream.push({
      event: eventName,
      data: JSON.stringify(data),
    });
  };

  if (!sessionId) {
    await sendEvent("error", { message: "No session ID provided" });
    await eventStream.close();
    return eventStream.send();
  }

  // Send initial connection event
  await sendEvent("start", {
    message: "SSE connection established. Monitoring progress...",
  });

  // Check if there's any existing progress data for this session
  const existingData = getProgressData(sessionId);
  if (Object.keys(existingData).length > 0) {
    await sendEvent("progress", existingData);
  }

  // Set up event listeners for this session
  const removeStartListener = onProgress(sessionId, "start", (data) => {
    sendEvent("start", data);
  });

  const removeProgressListener = onProgress(sessionId, "progress", (data) => {
    sendEvent("progress", data);
  });

  const removeCompleteListener = onProgress(sessionId, "complete", (data) => {
    sendEvent("complete", data);
    cleanupProgressData(sessionId);
  });

  const removeErrorListener = onProgress(sessionId, "error", (data) => {
    sendEvent("error", data);
  });

  // Clean up all listeners when the connection is closed
  eventStream.onClosed(() => {
    removeStartListener();
    removeProgressListener();
    removeCompleteListener();
    removeErrorListener();
    console.log(
      `Client disconnected from progress stream for session ${sessionId}`,
    );
  });

  // Return the event stream (keeps connection open until client disconnects)
  return eventStream.send();
});
