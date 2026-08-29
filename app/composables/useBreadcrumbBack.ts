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
