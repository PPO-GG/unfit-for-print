import type { ProfileFriend } from "~/types/profile";
import { PROFILE_FRIENDS_MOCK } from "~/composables/useProfileMockData";

/**
 * Returns the player's friend list.
 *
 * STUB: there's no friends graph yet. A real impl needs a `friendships`
 * collection (requester + target + status: pending/accepted/blocked) plus
 * presence tracking via the Teleportal server's active-doc list.
 */
export function useProfileFriends() {
  const friends = computed<ProfileFriend[]>(() => PROFILE_FRIENDS_MOCK);
  const onlineCount = computed(
    () => friends.value.filter((f) => f.status === "online").length,
  );
  return { friends, onlineCount };
}
