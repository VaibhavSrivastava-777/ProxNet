/**
 * Utility to safely open external links (LinkedIn searches, profiles, company career portals).
 * When running inside the native Android app (via window.AndroidBridge), it delegates to the native
 * Android system Intent (ACTION_VIEW) so it opens in the external browser or native app (e.g. LinkedIn).
 * When running on the website/desktop, it opens in a new tab/window via window.open(url, "_blank").
 */

export function openExternalUrl(url: string, target: string = "_blank"): void {
  if (typeof window === "undefined" || !url) return;

  // 1. Check if running inside native Android app with AndroidBridge
  const androidBridge = (window as unknown as { AndroidBridge?: { openExternalUrl?: (url: string) => void } }).AndroidBridge;
  if (androidBridge && typeof androidBridge.openExternalUrl === "function") {
    try {
      androidBridge.openExternalUrl(url);
      return;
    } catch (e) {
      console.warn("Failed to open external URL via AndroidBridge, falling back:", e);
    }
  }

  // 2. Standard Web fallback: open in a new window/tab
  try {
    const newWindow = window.open(url, target, "noopener,noreferrer");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      window.location.assign(url);
    }
  } catch {
    window.location.assign(url);
  }
}

export function handleExternalLinkClick(url: string) {
  return (e: React.MouseEvent) => {
    const androidBridge = typeof window !== "undefined"
      ? (window as unknown as { AndroidBridge?: { openExternalUrl?: (url: string) => void } }).AndroidBridge
      : null;
    if (androidBridge && typeof androidBridge.openExternalUrl === "function") {
      e.preventDefault();
      androidBridge.openExternalUrl(url);
    }
  };
}
