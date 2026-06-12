"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import type { CompanyCluster } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function MapUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng]);
  }, [center.lat, center.lng, map]);
  return null;
}

const customPinIcon = typeof window !== "undefined" ? L.divIcon({
  className: "custom-pin",
  html: `<div style="
    color: var(--color-primary);
    transform: translate(-50%, -100%);
    width: 24px;
    height: 24px;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
    </svg>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
}) : null;

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
  return customPinIcon ? <Marker position={[lat, lng]} icon={customPinIcon} /> : null;
}

function CompanyMarker({ cluster, onClick }: { cluster: CompanyCluster; onClick: () => void }) {
  const [icon, setIcon] = useState<L.DivIcon | null>(null);

  useEffect(() => {

    setIcon(
      L.divIcon({
        className: "company-cluster-icon",
        html: `<div style="
          position: relative;
          width: 32px;
          height: 32px;
          cursor: pointer;
          transform: translate(-50%, -50%);
        ">
          <img
            src="${cluster.logoUrl}"
            alt=""
            style="
              width: 32px !important;
              height: 32px !important;
              min-width: 32px !important;
              min-height: 32px !important;
              max-width: 32px !important;
              max-height: 32px !important;
              border-radius: 50%;
              object-fit: contain;
              border: 2px solid #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.2);
              background-color: #ffffff;
              display: block;
            "
            onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(cluster.company)}&background=0891B2&color=fff&size=128&rounded=50';"
          />
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: #0891B2;
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            line-height: 1;
            padding-bottom: 1px;
          ">
            ${cluster.count > 99 ? '99+' : cluster.count}
          </div>
        </div>`,
        iconSize: [0, 0] as any, // Use 0,0 and CSS transform for dynamic sizing
        iconAnchor: [0, 0],
      })
    );
  }, [cluster]);

  if (!icon) return null;
  return <Marker position={[cluster.lat, cluster.lng]} icon={icon} eventHandlers={{ click: onClick }} />;
}

interface Props {
  center: { lat: number; lng: number };
  radius: number;
  clusters: CompanyCluster[];
  onMoveCenter: (lat: number, lng: number) => void;
  onCompanyClick: (company: string) => void;
}

export function ProximityMapInner({ center, radius, clusters, onMoveCenter, onCompanyClick }: Props) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={17} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} />
      <DraggableCenter lat={center.lat} lng={center.lng} onMove={onMoveCenter} />
      <Circle
        center={[center.lat, center.lng]}
        radius={radius}
        pathOptions={{
          color: "#0891B2",
          fillColor: "#67E8F9",
          fillOpacity: 0.12,
          weight: 2,
        }}
      />
      {clusters.map((c) => (
        <CompanyMarker key={c.company} cluster={c} onClick={() => onCompanyClick(c.company)} />
      ))}
    </MapContainer>
  );
}
