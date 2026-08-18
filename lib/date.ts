export function parseSafeDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const formattedStr = typeof dateStr === "string" ? dateStr.replace(" ", "T") : dateStr;
  const d = new Date(formattedStr);
  return isNaN(d.getTime()) ? null : d;
}

export function isPastEvent(event: any): boolean {
  if (!event) return false;
  const now = Date.now();
  const endDate = parseSafeDate(event.ends_at);
  if (endDate) return endDate.getTime() < now;

  const startDate = parseSafeDate(event.starts_at);
  if (startDate) return startDate.getTime() < now;

  return false;
}
