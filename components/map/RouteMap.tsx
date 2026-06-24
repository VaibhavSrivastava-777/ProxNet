"use client";

import dynamic from "next/dynamic";

const RouteMapWrapper = dynamic(
  () => import("./RouteMapInner").then((m) => m.RouteMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Loading route map...
      </div>
    ),
  }
);

interface RouteMapProps {
  startLat: number;
  startLng: number;
  destLat: number;
  destLng: number;
  startName: string;
  destName: string;
}

export function RouteMap(props: RouteMapProps) {
  return <RouteMapWrapper {...props} />;
}
