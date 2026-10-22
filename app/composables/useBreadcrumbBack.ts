import type { InjectionKey, Ref } from "vue";

/**
 * Returns the route one path segment above the current page.
 *
 * This intentionally derives the destination from the URL instead of browser
 * history, so the shared back button behaves like a breadcrumb.
 */
export function getBreadcrumbBackPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  segments.pop();

  return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

/** i18n key naming each screen that is ever a back-button destination. */
export const SCREEN_LABEL_KEYS: Readonly<Record<string, string>> = {
  "/": "nav.home",
  "/legal": "nav.legal",
  "/admin": "nav.admin",
  "/admin/cards": "nav.admin_cards",
  "/admin/decorations": "nav.admin_decorations",
  "/admin/issues": "nav.admin_issues",
};

/** Home and the game room have their own exits, so they get no back button. */
export function showsScreenBack(path: string): boolean {
  return path !== "/" && !path.startsWith("/game/");
}

/** Names the parent screen; a parent missing from the map reads "Back". */
export function getBreadcrumbBackLabelKey(path: string): string {
  return SCREEN_LABEL_KEYS[getBreadcrumbBackPath(path)] ?? "nav.back";
}

/** Viewport edges of the layout's fixed back button, provided to titles. */
export interface BackButtonEdges {
  right: number;
  bottom: number;
}

export const BACK_BUTTON_EDGES: InjectionKey<Readonly<Ref<BackButtonEdges | null>>> =
  Symbol("backButtonEdges");

const TITLE_GAP_PX = 12;

/**
 * Left padding a page title needs to clear the back button. `title.top` is
 * measured from the top of the document, so the answer does not change as
 * the page scrolls under the fixed button.
 */
export function titleClearance(
  back: BackButtonEdges | null,
  title: { left: number; top: number },
): number {
  if (!back || title.top >= back.bottom) return 0;
  return Math.max(0, back.right + TITLE_GAP_PX - title.left);
}
