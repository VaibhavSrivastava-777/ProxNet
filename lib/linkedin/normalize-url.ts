export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.includes("linkedin.com")) return null;
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `https://www.linkedin.com${path}`;
  } catch {
    return null;
  }
}
