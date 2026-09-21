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

/**
 * User-friendly LinkedIn URL formatter:
 * Handles full URLs (stripping query/tracking params), shorthand domains, and standalone handles.
 */
export function formatLinkedInUrl(input: string | null | undefined): string {
  if (!input) return "";
  let clean = input.trim();
  if (!clean) return "";

  // Remove tracking query parameters and hash
  clean = clean.split("?")[0].split("#")[0].replace(/\/+$/, "");

  // If already starts with http:// or https://
  if (/^https?:\/\//i.test(clean)) {
    try {
      const parsed = new URL(clean);
      if (parsed.hostname.includes("linkedin.com")) {
        let pathname = parsed.pathname.replace(/\/+$/, "");
        if (!pathname.startsWith("/in/") && pathname.length > 1) {
          pathname = `/in${pathname}`;
        }
        return `https://www.linkedin.com${pathname}`;
      }
      return clean;
    } catch {
      return clean;
    }
  }

  // If starts with (www.)linkedin.com
  if (/^(?:www\.)?linkedin\.com/i.test(clean)) {
    const withoutDomain = clean.replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/?/i, "");
    const pathname = withoutDomain.startsWith("in/") ? withoutDomain : `in/${withoutDomain}`;
    return `https://www.linkedin.com/${pathname.replace(/\/+$/, "")}`;
  }

  // If starts with in/
  if (/^in\//i.test(clean)) {
    return `https://www.linkedin.com/${clean.replace(/\/+$/, "")}`;
  }

  // Otherwise assume it's a handle / slug
  const username = clean.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (!username) return "";
  return `https://www.linkedin.com/in/${username}`;
}

/**
 * Checks whether a LinkedIn URL was synthetically auto-generated from an OAuth sub/opaque ID
 * (e.g. "https://www.linkedin.com/in/8y7d_lckr2" generated from sub "8y7D_lckr2").
 */
export function isSyntheticLinkedInUrl(url: string | null | undefined, sub?: string | null): boolean {
  if (!url?.trim()) return false;
  const cleanUrl = url.trim().toLowerCase();
  if (sub?.trim()) {
    const cleanSub = sub.trim().toLowerCase();
    if (
      cleanUrl === `https://www.linkedin.com/in/${cleanSub}` ||
      cleanUrl.endsWith(`/in/${cleanSub}`) ||
      cleanUrl.endsWith(`/in/${cleanSub}/`)
    ) {
      return true;
    }
  }
  return false;
}
