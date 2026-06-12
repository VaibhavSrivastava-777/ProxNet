"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng]);
  }, [center.lat, center.lng, map]);
  return null;
}

function CompanyMarker({ cluster, onClick }: { cluster: any; onClick: () => void }) {
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
        iconSize: [0, 0] as any,
        iconAnchor: [0, 0],
      })
    );
  }, [cluster]);

  if (!icon) return null;
  return <Marker position={[cluster.lat, cluster.lng]} icon={icon} eventHandlers={{ click: onClick }} />;
}

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  radius?: number;
  clusters?: any[];
  onCompanyClick?: (company: string) => void;
}

export function LocationPickerMap({ lat, lng, onChange, radius, clusters, onCompanyClick }: Props) {
  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }, []);

  const position: [number, number] =
    lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
  const hasMarker = lat != null && lng != null;

  return (
    <MapContainer center={position} zoom={hasMarker ? 16 : 12} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={{ lat: position[0], lng: position[1] }} />
      <MapClickHandler onPick={onChange} />
      {hasMarker && (
        <Marker
          position={[lat, lng]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onChange(p.lat, p.lng);
            },
          }}
        />
      )}
      {hasMarker && radius != null && (
        <Circle
          center={[lat, lng]}
          radius={radius}
          pathOptions={{
            color: "#0891B2",
            fillColor: "#67E8F9",
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
      )}
      {hasMarker &&
        clusters?.map((c) => (
          <CompanyMarker
            key={c.company}
            cluster={c}
            onClick={() => onCompanyClick?.(c.company)}
          />
        ))}
    </MapContainer>
  );
}
