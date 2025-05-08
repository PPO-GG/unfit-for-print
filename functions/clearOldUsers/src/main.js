// clearOldUsers/src/main.js
import { Client, Users, Query } from 'node-appwrite'

export default async function ({ req, res, log, error }) {
  // Initialize Appwrite SDK
  const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

  const users = new Users(client)

  try {
    log('Starting unverified users cleanup process');

    // Calculate the timestamp for 2 hours ago
    const now = new Date();
    log('Current time:', now.toISOString());

    const accountAge = new Date(now);
    accountAge.setHours(accountAge.getHours() - 2);
    const staleTimestamp = accountAge.toISOString();

    log('Looking for unverified users inactive since:', staleTimestamp);

    // Query for all users
    const usersList = await users.list();

    let deletedUsersCount = 0;

    // Log the first user object structure for debugging
    if (usersList.users.length > 0) {
      log('First user object structure:', JSON.stringify(usersList.users[0], null, 2));
    }

    // Process each user
    for (const user of usersList.users) {
      // Check if the user is unverified
      // We'll check for common verification properties
      const isUnverified = user.emailVerification === false || user.status === 'unverified' || !user.emailVerification;

      log(`User ${user.$id}: isUnverified=${isUnverified}`);

      if (isUnverified) {
        // Check if the user has been inactive for more than 2 hours
        // Use the $updatedAt field from Appwrite as the last activity time
        const lastActivityTime = user.$updatedAt;

        // Parse dates and ensure they're valid
        const lastActivityDate = new Date(lastActivityTime);
        const staleDate = new Date(staleTimestamp);

        // Check if dates are valid
        const isLastActivityValid = !isNaN(lastActivityDate.getTime());
        const isStaleValid = !isNaN(staleDate.getTime());

        // Log detailed information for debugging
        log(`User ${user.$id}, last active: ${lastActivityTime}`);
        log(`Parsed last activity: ${lastActivityDate.toISOString()}, valid: ${isLastActivityValid}`);
        log(`Parsed stale timestamp: ${staleDate.toISOString()}, valid: ${isStaleValid}`);

        // Only compare if both dates are valid
        const shouldDelete = isLastActivityValid && isStaleValid && lastActivityDate < staleDate;
        log(`Should delete: ${shouldDelete}`);

        if (shouldDelete) {
          log(`Found stale unverified user: ${user.$id}, last active: ${lastActivityTime}`);

          try {
            // Delete the user
            await users.delete(user.$id);
            deletedUsersCount++;
            log(`Deleted stale unverified user: ${user.$id}`);
          } catch (deleteErr) {
            log(`Failed to delete user ${user.$id}: ${deleteErr.message}`);
          }
        }
      }
    }

    log(`Cleanup complete. Deleted ${deletedUsersCount} stale unverified users.`);

    return res.json({
      success: true,
      staleUsersDeleted: deletedUsersCount
    });
  } catch (err) {
    error('clearOldUsers error: ' + err.message);
    return res.json({ success: false, error: err.message });
  }
}
