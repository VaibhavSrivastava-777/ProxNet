export interface ParsedHeadline {
  company: string | null;
  title: string | null;
}

/**
 * Parses a LinkedIn headline string into separated job title and company name.
 * Handles patterns such as:
 * - "Software Engineer at Google"
 * - "Senior Product Manager @ Microsoft"
 * - "Founder & CEO | Acme Corp"
 * - "Lead Architect - Amazon AWS"
 * - "Director of Engineering, Meta"
 */
export function parseLinkedInHeadline(headline: string | null | undefined): ParsedHeadline {
  if (!headline) return { company: null, title: null };
  const h = headline.trim();
  if (!h) return { company: null, title: null };

  // 1. Check for " at " or " @ "
  const atMatch = h.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (atMatch) {
    const title = cleanSegment(atMatch[1]);
    const company = cleanSegment(atMatch[2]);
    return { title: title || null, company: company || null };
  }

  // 2. Check for pipe separator " | "
  const pipeMatch = h.match(/^(.+?)\s*\|\s*(.+)$/);
  if (pipeMatch) {
    const title = cleanSegment(pipeMatch[1]);
    const company = cleanSegment(pipeMatch[2]);
    return { title: title || null, company: company || null };
  }

  // 3. Check for dash/hyphen separator " - " (excluding hyphenated words)
  const dashMatch = h.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    const title = cleanSegment(dashMatch[1]);
    const company = cleanSegment(dashMatch[2]);
    return { title: title || null, company: company || null };
  }

  // 4. Check for comma separator e.g. "CEO, Acme Corp"
  const commaMatch = h.match(/^([^,]+),\s*([^,]+)$/);
  if (commaMatch) {
    const title = cleanSegment(commaMatch[1]);
    const company = cleanSegment(commaMatch[2]);
    return { title: title || null, company: company || null };
  }

  // Fallback: entire string as title
  return { title: cleanSegment(h) || null, company: null };
}

function cleanSegment(segment: string): string {
  return segment
    .replace(/^[@|,\-–—\s]+|[@|,\-–—\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
