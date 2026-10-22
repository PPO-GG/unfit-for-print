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
