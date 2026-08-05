'use client';

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import Script from "next/script";

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

interface GoogleAnalyticsProps {
  gaId?: string;
}

function GoogleAnalyticsPageTracker({ formattedId }: { formattedId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!formattedId || typeof window === "undefined" || !window.gtag) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    window.gtag("config", formattedId, {
      page_path: url,
    });
  }, [pathname, searchParams, formattedId]);

  return null;
}

export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps) {
  const id =
    gaId ||
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    process.env.NEXT_PUBLIC_GA_ID ||
    "545512337";

  const formattedId =
    id.startsWith("G-") || id.startsWith("GT-") ? id : `G-${id}`;

  if (!formattedId) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${formattedId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${formattedId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsPageTracker formattedId={formattedId} />
      </Suspense>
    </>
  );
}
