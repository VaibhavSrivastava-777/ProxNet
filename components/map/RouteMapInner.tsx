"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function MapBoundsUpdater({ start, dest }: { start: [number, number]; dest: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([start, dest]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [start, dest, map]);
  return null;
}

interface RouteMapInnerProps {
  startLat: number;
  startLng: number;
  destLat: number;
  destLng: number;
  startName: string;
  destName: string;
}

export function RouteMapInner({ startLat, startLng, destLat, destLng, startName, destName }: RouteMapInnerProps) {
  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }, []);

  const start: [number, number] = [startLat, startLng];
  const dest: [number, number] = [destLat, destLng];

  // Green pin icon for Start, Red pin icon for Dest
  const startIcon = L.divIcon({
    html: `<div style="background-color: #22c55e; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  const destIcon = L.divIcon({
    html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  return (
    <MapContainer center={start} zoom={13} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsUpdater start={start} dest={dest} />
      <Marker position={start} icon={startIcon} />
      <Marker position={dest} icon={destIcon} />
      <Polyline positions={[start, dest]} pathOptions={{ color: "#0ea5e9", weight: 3, dashArray: "5, 5" }} />
    </MapContainer>
  );
}
