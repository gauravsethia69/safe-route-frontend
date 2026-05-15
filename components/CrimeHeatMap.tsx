"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

type HeatPoint = {
  lat: number;
  lng: number;
  intensity: number;
};

type CrimeHeatMapProps = {
  points: HeatPoint[];
  center?: [number, number];
};

function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    const validPoints = points
      .filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          !Number.isNaN(p.lat) &&
          !Number.isNaN(p.lng)
      )
      .map((p) => [p.lat, p.lng, p.intensity || 0.8]);

    if (validPoints.length === 0) return;

    const heatLayer = (L as any).heatLayer(validPoints, {
      radius: 35,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      minOpacity: 0.4,
    });

    heatLayer.addTo(map);

    const bounds = L.latLngBounds(
      validPoints.map((p) => [p[0], p[1]] as [number, number])
    );

    map.fitBounds(bounds, {
      padding: [30, 30],
      maxZoom: 13,
    });

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

export default function CrimeHeatMap({
  points,
  center = [22.7196, 75.8577],
}: CrimeHeatMapProps) {
  return (
    <div className="h-[400px] w-full overflow-hidden rounded-3xl border border-white/10">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <HeatLayer points={points} />
      </MapContainer>
    </div>
  );
}