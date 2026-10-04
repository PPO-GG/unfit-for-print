export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export interface ShareNavigator {
  share?: (data: { title?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
}

/**
 * Share a lobby invite: the phone's share sheet where there is one, the
 * clipboard otherwise. Inside the Discord Activity the share sheet would hand
 * out a link that opens the website rather than the Activity, so it copies.
 */
export async function shareInvite(
  url: string,
  opts: { title: string; inDiscord: boolean; nav?: ShareNavigator },
): Promise<ShareOutcome> {
  const nav: ShareNavigator =
    opts.nav ?? (typeof navigator !== "undefined" ? (navigator as ShareNavigator) : {});

  if (!opts.inDiscord && nav.share) {
    try {
      await nav.share({ title: opts.title, url });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
      // fall through to the clipboard
    }
  }
  if (nav.clipboard) {
    try {
      await nav.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
