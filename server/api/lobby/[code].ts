import { defineEventHandler, getRouterParam } from "h3";
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code")?.toUpperCase();

  if (!code) {
    return { error: "Missing lobby code" };
  }

  const { databases } = useAppwriteAdmin();
  const config = useRuntimeConfig();

  const dbId = config.public.appwriteDatabaseId as string;
  const collectionId = config.public.appwriteLobbyCollectionId as string;

  const res = await databases.listDocuments(dbId, collectionId, [
    Query.equal("code", code),
  ]);

  if (!res.total) {
    return { error: "Lobby not found" };
  }

  const lobby = res.documents[0];

  // Only return safe data to the frontend
  return {
    name: lobby.name,
    code: lobby.code,
    hostUserId: lobby.hostUserId,
    isPrivate: lobby.isPrivate,
    currentPlayers: lobby.currentPlayers,
    // Add more fields as needed — but filter sensitive stuff
  };
});
