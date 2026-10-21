/** Only allow same-app relative paths (blocks open redirects). */
export function sanitizeRedirect(url: unknown): string {
  if (typeof url !== "string" || !url) {
    return "/";
  }
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("://")) {
    return "/";
  }
  return url;
}
