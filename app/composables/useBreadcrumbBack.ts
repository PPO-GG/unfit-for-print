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

export const SCREEN_LABEL_KEYS: Readonly<Record<string, string>> = {};

export function showsScreenBack(_path: string): boolean {
  return false;
}

export function getBreadcrumbBackLabelKey(_path: string): string {
  return "";
}
