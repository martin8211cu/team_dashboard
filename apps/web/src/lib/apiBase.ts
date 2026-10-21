/** Public API origin baked in at build time. Empty = same origin as the web app (reverse proxy). */
const rawBase = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

export const apiBaseUrl = rawBase.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}
