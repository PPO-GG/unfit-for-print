/**
 * Redirect Discord Activity iframe to /activity page.
 *
 * Discord opens Activities at the root URL (/). This middleware detects
 * the Discord iframe context (frame_id + instance_id query params) and
 * redirects to /activity while preserving query params so the client-side
 * Discord SDK detection still works.
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  if (
    url.pathname === "/" &&
    url.searchParams.has("frame_id") &&
    url.searchParams.has("instance_id")
  ) {
    return sendRedirect(event, `/activity?${url.searchParams.toString()}`);
  }
});
