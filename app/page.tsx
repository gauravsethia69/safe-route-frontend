"use client";

import axios from "axios";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, LocateFixed, Flame, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

import {
  signOut,
  onAuthStateChanged,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

const SafeRoutePlanner = dynamic(
  () => import("@/components/SafeRoutePlanner"),
  {
    ssr: false,
  }
);

const CrimeHeatMap = dynamic(() => import("@/components/CrimeHeatMap"), {
  ssr: false,
});

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

type HeatPoint = {
  lat: number;
  lng: number;
  intensity: number;
};

export default function Home() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [locationName, setLocationName] = useState("");

  const [risk, setRisk] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);

  const [loading, setLoading] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null
  );
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  const API = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    getLocation();
    fetchHeatmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHeatmap = async () => {
    try {
      setHeatmapLoading(true);
      const res = await axios.get(`${API}/heatmap`);
      setHeatPoints(res.data.points || []);
    } catch (error) {
      console.error("fetchHeatmap error:", error);
      toast.error("Heatmap data not available");
    } finally {
      setHeatmapLoading(false);
    }
  };

  const clearRecaptcha = async () => {
    try {
      if (window.recaptchaVerifier) {
        await window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    } catch (_) {
      window.recaptchaVerifier = undefined;
    }

    if (recaptchaContainerRef.current) {
      recaptchaContainerRef.current.innerHTML = "";
    }
  };

  const initRecaptcha = async (): Promise<RecaptchaVerifier> => {
    await clearRecaptcha();

    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "normal",
      callback: () => {},
      "expired-callback": async () => {
        toast.error("reCAPTCHA expired. Please try again.");
        await clearRecaptcha();
        setOtpSent(false);
      },
    });

    await verifier.render();
    window.recaptchaVerifier = verifier;

    return verifier;
  };

  const sendOTP = async () => {
    if (!phone) {
      toast.error("Enter mobile number");
      return;
    }

    if (!phone.startsWith("+91") || phone.length !== 13) {
      toast.error("Use format: +91XXXXXXXXXX");
      return;
    }

    setSendingOtp(true);

    try {
      const verifier = await initRecaptcha();

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        verifier
      );

      setConfirmation(confirmationResult);
      setOtpSent(true);
      toast.success("OTP sent successfully!");
    } catch (error: any) {
      console.error("sendOTP error:", error);
      await clearRecaptcha();
      setOtpSent(false);

      if (error.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please wait and try again.");
      } else if (error.code === "auth/invalid-phone-number") {
        toast.error("Invalid phone number. Use format: +91XXXXXXXXXX");
      } else if (error.code === "auth/captcha-check-failed") {
        toast.error("reCAPTCHA verification failed. Refresh and retry.");
      } else {
        toast.error(error.message || "Failed to send OTP");
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOTP = async () => {
    if (!confirmation) {
      toast.error("Please send OTP first");
      return;
    }

    if (!otp || otp.length !== 6) {
      toast.error("Enter a valid 6-digit OTP");
      return;
    }

    setVerifyingOtp(true);

    try {
      await confirmation.confirm(otp);
      await clearRecaptcha();
      setOtpSent(false);
      toast.success("Login successful!");
    } catch (error: any) {
      console.error("verifyOTP error:", error);

      if (error.code === "auth/invalid-verification-code") {
        toast.error("Incorrect OTP. Please try again.");
      } else if (error.code === "auth/code-expired") {
        toast.error("OTP expired. Please request a new one.");
        await clearRecaptcha();
        setOtpSent(false);
        setConfirmation(null);
      } else {
        toast.error(error.message || "OTP verification failed");
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      await clearRecaptcha();

      setPhone("");
      setOtp("");
      setOtpSent(false);
      setConfirmation(null);

      toast.success("Logged out successfully");
    } catch (error: any) {
      console.error("logout error:", error);
      toast.error(error.message || "Logout failed");
    }
  };

  const fetchData = async (latitude: number, longitude: number) => {
    try {
      setLoading(true);

      const [riskRes, incidentRes] = await Promise.all([
        axios.get(`${API}/risk-score?lat=${latitude}&lon=${longitude}`),
        axios.get(`${API}/incidents-nearby?lat=${latitude}&lon=${longitude}`),
      ]);

      setRisk(riskRes.data);
      setIncidents(incidentRes.data.incidents || []);
      setLat(latitude);
      setLon(longitude);

      toast.success("Safety data loaded");
    } catch (err) {
      console.error(err);
      toast.error("Backend not running or unreachable");
    } finally {
      setLoading(false);
    }
  };

  const searchLocationByName = async () => {
    if (!locationName.trim()) {
      toast.error("Enter a location name");
      return;
    }

    try {
      setSearchingLocation(true);

      const res = await axios.get(
        `${API}/geocode?location=${encodeURIComponent(locationName)}`
      );

      const latitude = res.data.latitude;
      const longitude = res.data.longitude;

      if (latitude === undefined || longitude === undefined) {
        toast.error("Invalid location response from backend");
        return;
      }

      await fetchData(latitude, longitude);

      toast.success(`Showing safety data for ${locationName}`);
    } catch (error: any) {
      console.error("searchLocationByName error:", error);
      toast.error(
        error.response?.data?.detail || "Location not found. Try adding city name."
      );
    } finally {
      setSearchingLocation(false);
    }
  };

  const reportIncident = async (crimeType: string) => {
    if (!auth.currentUser) {
      toast.error("Please login first to report an incident");
      return;
    }

    if (lat === null || lon === null) {
      toast.error("Location not available. Please fetch your location first.");
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();

      const res = await axios.post(
        `${API}/report-incident?lat=${lat}&lon=${lon}&type=${crimeType}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(res.data.message || "Incident reported successfully");

      fetchData(lat, lon);
      fetchHeatmap();
    } catch (error: any) {
      console.error("reportIncident error:", error);
      toast.error(error.response?.data?.detail || "Failed to report incident");
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchData(position.coords.latitude, position.coords.longitude);
      },
      () => {
        toast.error("Location permission denied");
      }
    );
  };

  const getRiskColor = () => {
    if (!risk) return "from-gray-500 to-gray-700";
    if (risk.risk_score < 35) return "from-green-400 to-emerald-700";
    if (risk.risk_score < 70) return "from-yellow-400 to-orange-600";
    return "from-red-500 to-red-800";
  };

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">
      <Toaster position="top-right" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#7c3aed22,transparent_35%),radial-gradient(circle_at_bottom_left,#06b6d422,transparent_35%)]" />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6 mb-10"
        >
          <div>
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              SafeRoute AI
            </h1>
            <p className="text-gray-400 mt-2 text-lg">
              Real-time neighborhood safety intelligence
            </p>
          </div>

          <div className="flex flex-wrap gap-3 bg-white/5 border border-white/10 rounded-3xl p-5">
            {user ? (
              <div className="flex flex-wrap items-center gap-4 w-full">
                <p className="text-green-400 font-semibold">
                  ✓ Logged in as {user.phoneNumber || "Firebase User"}
                </p>

                <button
                  onClick={logout}
                  className="bg-red-600 px-5 py-3 rounded-2xl font-semibold hover:bg-red-500 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 w-full">
                <input
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
                  disabled={otpSent}
                  className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none disabled:opacity-50 w-44"
                />

                <button
                  onClick={sendOTP}
                  disabled={sendingOtp || otpSent}
                  className="bg-cyan-600 px-5 py-3 rounded-2xl font-semibold hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingOtp ? "Sending…" : otpSent ? "OTP Sent ✓" : "Send OTP"}
                </button>

                {otpSent && (
                  <>
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none w-44"
                    />

                    <button
                      onClick={verifyOTP}
                      disabled={verifyingOtp}
                      className="bg-purple-600 px-5 py-3 rounded-2xl font-semibold hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyingOtp ? "Verifying…" : "Verify OTP"}
                    </button>

                    <button
                      onClick={async () => {
                        setOtpSent(false);
                        setOtp("");
                        setConfirmation(null);
                        await clearRecaptcha();
                      }}
                      className="text-gray-400 underline text-sm self-center hover:text-white transition-colors"
                    >
                      Resend OTP
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div
            id="recaptcha-container"
            ref={recaptchaContainerRef}
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "8px",
              minHeight: otpSent || user ? 0 : "80px",
            }}
          />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={getLocation}
              className="bg-cyan-500 px-5 py-3 rounded-2xl flex items-center gap-2 hover:bg-cyan-400 transition-all font-semibold"
            >
              <LocateFixed size={18} />
              Current Location
            </button>

            <input
              type="text"
              placeholder="Enter location name, e.g. Vijay Nagar"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  searchLocationByName();
                }
              }}
              className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 outline-none w-80"
            />

            <button
              onClick={searchLocationByName}
              disabled={searchingLocation}
              className="bg-purple-600 px-5 py-3 rounded-2xl hover:bg-purple-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <MapPin size={18} />
              {searchingLocation ? "Searching…" : "Search Location"}
            </button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <Flame className="text-red-400" />
              <h2 className="text-2xl font-bold">Crime Heatmap</h2>
            </div>

            <div className="mb-4 bg-black/40 px-4 py-3 rounded-2xl border border-white/10 flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-sm text-gray-300">
                  LAT: {lat?.toFixed(4) ?? "—"}
                </p>
                <p className="text-sm text-gray-300">
                  LON: {lon?.toFixed(4) ?? "—"}
                </p>
              </div>

              <p className="text-sm text-red-300 font-semibold">
                {heatPoints.length} heat points
              </p>
            </div>

            {heatmapLoading ? (
              <div className="h-[400px] rounded-3xl bg-zinc-950 border border-white/10 flex items-center justify-center text-gray-400">
                Loading heatmap…
              </div>
            ) : heatPoints.length > 0 ? (
              <CrimeHeatMap points={heatPoints} />
            ) : (
              <div className="h-[400px] rounded-3xl bg-zinc-950 border border-white/10 flex items-center justify-center text-gray-400">
                No heatmap data found.
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-green-400" />
              <h2 className="text-2xl font-bold">Risk Meter</h2>
            </div>

            <div
              className={`h-56 rounded-3xl bg-gradient-to-br ${getRiskColor()} flex flex-col items-center justify-center shadow-2xl`}
            >
              <h1 className="text-7xl font-black">
                {risk?.risk_score ?? "--"}
              </h1>

              <p className="text-xl font-semibold mt-2">
                {risk?.risk_level ?? "Scanning"}
              </p>
            </div>

            <div className="mt-6 bg-black/30 rounded-2xl p-5 border border-white/10">
              <p className="text-gray-300 leading-relaxed">
                {risk?.advice ??
                  "Analyzing nearby crime patterns and route safety…"}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {[
                {
                  label: "Report Theft",
                  type: "THEFT",
                  color: "bg-red-600 hover:bg-red-500",
                },
                {
                  label: "Report Assault",
                  type: "ASSAULT",
                  color: "bg-orange-600 hover:bg-orange-500",
                },
                {
                  label: "Report Murder",
                  type: "MURDER",
                  color: "bg-purple-700 hover:bg-purple-600",
                },
                {
                  label: "Report Accident",
                  type: "ACCIDENT",
                  color: "bg-yellow-600 hover:bg-yellow-500",
                },
              ].map(({ label, type, color }) => (
                <button
                  key={type}
                  onClick={() => reportIncident(type)}
                  className={`${color} px-4 py-3 rounded-2xl font-semibold transition-colors`}
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        <SafeRoutePlanner />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="text-red-400" />
            <h2 className="text-2xl font-bold">Nearby Incidents</h2>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-400 animate-pulse text-xl">
              Scanning area…
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-xl">
              No nearby incidents found.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {incidents.map((incident, index) => (
                <motion.div
                  key={incident.id ?? index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-black/40 border border-white/10 rounded-2xl p-5 hover:border-cyan-400/40 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-semibold">
                      {incident.type}
                    </span>

                    <span className="text-cyan-400 font-bold">
                      {incident.distance_km} km
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-300">
                    <p>
                      Risk Score:{" "}
                      <span className="text-white font-bold">
                        {incident.risk_score}
                      </span>
                    </p>

                    <p>
                      Latitude:{" "}
                      <span className="text-white">{incident.latitude}</span>
                    </p>

                    <p>
                      Longitude:{" "}
                      <span className="text-white">{incident.longitude}</span>
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}