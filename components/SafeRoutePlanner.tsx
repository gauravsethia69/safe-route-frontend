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

type GeoPoint = {
  lat: number;
  lng: number;
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
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [pickupLocation, setPickupLocation] = useState("");
  const [dropLocation, setDropLocation] = useState("");

  const [route, setRoute] = useState<SafeRoute | null>(null);

  const [loading, setLoading] = useState(false);

  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null
  );

  const geocodeLocation = async (
    location: string
  ): Promise<GeoPoint> => {
    const res = await axios.get(
      `${API}/geocode?location=${encodeURIComponent(location)}`
    );

    return {
      lat: res.data.latitude,
      lng: res.data.longitude,
    };
  };

  const findSafeRoute = async () => {
    if (!pickupLocation.trim() || !dropLocation.trim()) {
      toast.error("Enter pickup and drop locations");
      return;
    }

    try {
      setLoading(true);

      setRoute(null);

      toast.loading("Finding safest route...", {
        id: "route",
      });

      // Convert names → coordinates
      const pickup = await geocodeLocation(pickupLocation);

      const drop = await geocodeLocation(dropLocation);

      // Call backend
      const res = await axios.post(
        `${API}/safe-route`,
        {
          start_lat: pickup.lat,
          start_lon: pickup.lng,
          end_lat: drop.lat,
          end_lon: drop.lng,
        }
      );

      const safestRoute =
        res.data.safest_route || res.data;

      setRoute(safestRoute);

      toast.success("Safest route generated", {
        id: "route",
      });

    } catch (error: any) {
      console.error("findSafeRoute error:", error);

      toast.error(
        error.response?.data?.detail ||
          "Failed to generate route",
        {
          id: "route",
        }
      );
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
      <h2 className="text-2xl font-bold mb-5">
        Safest Route Navigation
      </h2>

      <div className="grid md:grid-cols-2 gap-3 mb-5">
        <input
          type="text"
          placeholder="Pickup location, e.g. Vijay Nagar"
          value={pickupLocation}
          onChange={(e) =>
            setPickupLocation(e.target.value)
          }
          className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none"
        />

        <input
          type="text"
          placeholder="Drop location, e.g. Rajwada"
          value={dropLocation}
          onChange={(e) =>
            setDropLocation(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              findSafeRoute();
            }
          }}
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
                <Popup>Pickup Location</Popup>
              </Marker>

              <Marker
                position={
                  route.coordinates[
                    route.coordinates.length - 1
                  ]
                }
              >
                <Popup>Destination</Popup>
              </Marker>

              <FitRoute coordinates={route.coordinates} />
            </>
          )}

          {userPosition && (
            <Marker position={userPosition}>
              <Popup>Your Live Location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {route && (
        <div className="mt-5 grid lg:grid-cols-3 gap-5">
          <div className="bg-black/30 rounded-2xl p-5 border border-white/10">
            <p className="text-gray-400">Distance</p>

            <h3 className="text-2xl font-bold">
              {route.distance_km} km
            </h3>
          </div>

          <div className="bg-black/30 rounded-2xl p-5 border border-white/10">
            <p className="text-gray-400">Duration</p>

            <h3 className="text-2xl font-bold">
              {route.duration_min} min
            </h3>
          </div>

          <div className="bg-black/30 rounded-2xl p-5 border border-white/10">
            <p className="text-gray-400">
              Safety Score
            </p>

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
          <h3 className="text-xl font-bold mb-4">
            Directions
          </h3>

          <div className="space-y-3">
            {route.directions?.map((step, index) => (
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