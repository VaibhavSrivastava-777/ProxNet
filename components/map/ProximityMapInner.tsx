"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { CompanyCluster } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function DraggableCenter({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return <Marker position={[lat, lng]} />;
}

function CompanyMarker({ cluster }: { cluster: CompanyCluster }) {
  const [icon, setIcon] = useState<L.DivIcon | null>(null);

  useEffect(() => {
    setIcon(
      L.divIcon({
        className: "company-cluster-icon",
        html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <img src="${cluster.logoUrl}" alt="" width="36" height="36" style="border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)" />
          <span style="background:#1d4ed8;color:#fff;font-size:11px;padding:2px 6px;border-radius:999px;white-space:nowrap;">${cluster.count} at ${cluster.company}</span>
        </div>`,
        iconSize: [120, 60],
        iconAnchor: [60, 30],
      })
    );
  }, [cluster]);

  if (!icon) return null;
  return <Marker position={[cluster.lat, cluster.lng]} icon={icon} />;
}

interface Props {
  center: { lat: number; lng: number };
  radius: number;
  clusters: CompanyCluster[];
  onMoveCenter: (lat: number, lng: number) => void;
}

export function ProximityMapInner({ center, radius, clusters, onMoveCenter }: Props) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={17} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <DraggableCenter lat={center.lat} lng={center.lng} onMove={onMoveCenter} />
      <Circle
        center={[center.lat, center.lng]}
        radius={radius}
        pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.15 }}
      />
      {clusters.map((c) => (
        <CompanyMarker key={c.company} cluster={c} />
      ))}
    </MapContainer>
  );
}
