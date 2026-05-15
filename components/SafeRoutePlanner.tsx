"use client";

import axios from "axios";
import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import toast from "react-hot-toast";

type Direction = {
  instruction: string;
  distance: number;
  duration: number;
};

type SafeRoute = {
  distance_km: number;
  duration_min: number;
  safety_score: number;
  nearby_crimes: number;
  coordinates: [number, number][];
  directions: Direction[];
};

function FitRoute({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();

  if (coordinates.length > 0) {
    const bounds = L.latLngBounds(coordinates);
    map.fitBounds(bounds, {
      padding: [40, 40],
    });
  }

  return null;
}

export default function SafeRoutePlanner() {
  const API = process.env.NEXT_PUBLIC_API_URL

  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropLat, setDropLat] = useState("");
  const [dropLng, setDropLng] = useState("");

  const [route, setRoute] = useState<SafeRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null
  );

  const findSafeRoute = async () => {
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      toast.error("Enter pickup and drop coordinates");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API}/safe-route`, {
        pickup_lat: Number(pickupLat),
        pickup_lng: Number(pickupLng),
        drop_lat: Number(dropLat),
        drop_lng: Number(dropLng),
      });

      setRoute(res.data.safest_route);
      toast.success("Safest route found");
    } catch (error) {
      console.error(error);
      toast.error("Failed to find safest route");
    } finally {
      setLoading(false);
    }
  };

  const startLiveTracking = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.watchPosition(
      (position) => {
        setUserPosition([
          position.coords.latitude,
          position.coords.longitude,
        ]);
      },
      () => {
        toast.error("Unable to track location");
      },
      {
        enableHighAccuracy: true,
      }
    );

    toast.success("Live tracking started");
  };

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
      <h2 className="text-2xl font-bold mb-5">Safest Route Navigation</h2>

      <div className="grid md:grid-cols-4 gap-3 mb-5">
        <input
          type="text"
          placeholder="Pickup Lat"
          value={pickupLat}
          onChange={(e) => setPickupLat(e.target.value)}
          className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none"
        />

        <input
          type="text"
          placeholder="Pickup Lng"
          value={pickupLng}
          onChange={(e) => setPickupLng(e.target.value)}
          className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none"
        />

        <input
          type="text"
          placeholder="Drop Lat"
          value={dropLat}
          onChange={(e) => setDropLat(e.target.value)}
          className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none"
        />

        <input
          type="text"
          placeholder="Drop Lng"
          value={dropLng}
          onChange={(e) => setDropLng(e.target.value)}
          className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={findSafeRoute}
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-5 py-3 rounded-2xl font-semibold"
        >
          {loading ? "Finding..." : "Find Safest Route"}
        </button>

        <button
          onClick={startLiveTracking}
          className="bg-cyan-600 hover:bg-cyan-500 px-5 py-3 rounded-2xl font-semibold"
        >
          Start Live Tracking
        </button>
      </div>

      <div className="h-[450px] rounded-3xl overflow-hidden border border-white/10">
        <MapContainer
          center={[22.7196, 75.8577]}
          zoom={12}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {route && (
            <>
              <Polyline
                positions={route.coordinates}
                weight={6}
              />

              <Marker position={route.coordinates[0]}>
                <Popup>Pickup</Popup>
              </Marker>

              <Marker position={route.coordinates[route.coordinates.length - 1]}>
                <Popup>Drop</Popup>
              </Marker>

              <FitRoute coordinates={route.coordinates} />
            </>
          )}

          {userPosition && (
            <Marker position={userPosition}>
              <Popup>Your live location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {route && (
        <div className="mt-5 grid lg:grid-cols-3 gap-5">
          <div className="bg-black/30 rounded-2xl p-5 border border-white/10">
            <p className="text-gray-400">Distance</p>
            <h3 className="text-2xl font-bold">{route.distance_km} km</h3>
          </div>

          <div className="bg-black/30 rounded-2xl p-5 border border-white/10">
            <p className="text-gray-400">Duration</p>
            <h3 className="text-2xl font-bold">{route.duration_min} min</h3>
          </div>

          <div className="bg-black/30 rounded-2xl p-5 border border-white/10">
            <p className="text-gray-400">Safety Score</p>
            <h3 className="text-2xl font-bold text-green-400">
              {route.safety_score}/100
            </h3>
            <p className="text-sm text-red-300">
              Nearby crimes: {route.nearby_crimes}
            </p>
          </div>
        </div>
      )}

      {route && (
        <div className="mt-5 bg-black/30 rounded-2xl p-5 border border-white/10 max-h-80 overflow-y-auto">
          <h3 className="text-xl font-bold mb-4">Directions</h3>

          <div className="space-y-3">
            {route.directions.map((step, index) => (
              <div
                key={index}
                className="border-b border-white/10 pb-3 text-gray-300"
              >
                <p className="font-semibold text-white">
                  {index + 1}. {step.instruction}
                </p>
                <p className="text-sm text-gray-400">
                  {step.distance} km • {step.duration} min
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}