export function getResourceEndpoint(raw: string): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`; // strip any path/query
  } catch {
    return raw; // fallback – assume already clean
  }
} 