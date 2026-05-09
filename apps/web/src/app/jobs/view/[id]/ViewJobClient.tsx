// web/src/app/jobs/view/[id]/UserClient.tsx 

"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import 'leaflet/dist/leaflet.css';
import { COMMON_TIMEZONES } from "@/lib/timezones";

export interface TimezoneOption {
  value: string;
  label: string;
}

type Job = {
  id: string;
  title: string;
  type: string;
  description: string;
  price: number;
  status: string;
  startDate: string;
  expiryDate: string;
  createdAt: string;
  timezone: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
  seekerId: string;
  seeker?: { 
    id: string;
    name: string;
    seekerRating?: number;
    seekerReviewCount?: number;
  } | null;
  workerId?: string | null;
  worker?: { name: string } | null;
  evaluationStartedAt?: string | null;
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ensures the date is rendered according to the Job's timezone, not the worker User's local browser time.
const formatJobDate = (dateString: string, tz: string) => {
  try {
    return new Date(dateString).toLocaleString(undefined, {
      timeZone: tz,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (e) {
    // Fallback if timezone string is invalid
    return new Date(dateString).toLocaleString();
  }
};

export default function ViewJobPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const mapRef = useRef<HTMLDivElement>(null);
  
  const [job, setJob] = useState<Job | null>(null);
  const [user, setUser] = useState<{id: string, name: string} | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number, address?: string, hasStoredLocation: boolean} | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveJob, setHasActiveJob] = useState(false); // NEW

  useEffect(() => {
    if (user) {
      fetch(`http://localhost:4000/api/users/${user.id}/active-job`)
        .then(res => res.json())
        .then(data => setHasActiveJob(!!data.activeJob))
        .catch(console.error);
    }
  }, [user, job]);

  const fetchJob = useCallback(() => {
    fetch(`http://localhost:4000/api/jobs/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          router.push("/jobs");
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch job");
        return res.json();
      })
      .then(data => {
        if (data) {
          setJob(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, [id, router]);

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:4000/api/jobs/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // When any job update is broadcasted, re-fetch this specific job's data
        if (data.type === "REFRESH_JOBS") {
          fetchJob();
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [fetchJob]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    
    const storedLocationStr = localStorage.getItem("lastLocation");
    let hasStored = false;

    if (storedLocationStr) {
      try {
        const parsedLoc = JSON.parse(storedLocationStr);
        if (parsedLoc && parsedLoc.lat && parsedLoc.lng) {
          setUserLocation({ 
            lat: parsedLoc.lat, 
            lng: parsedLoc.lng, 
            address: parsedLoc.name || "", 
            hasStoredLocation: true 
          });
          hasStored = true;
        }
      } catch (e) {
        console.error("Failed to parse stored lastLocation", e);
      }
    }

    // Fallback to browser geolocation if no local storage location is found
    if (!hasStored && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ 
          lat: position.coords.latitude, 
          lng: position.coords.longitude, 
          address: "", 
          hasStoredLocation: false 
        }),
        (err) => console.error("Error getting location", err)
      );
    }
    
    fetchJob();
  }, [id]);

  useEffect(() => {
    if (typeof window !== "undefined" && !loading && job?.lat && job?.lng && mapRef.current) {
      import("leaflet").then((L) => {
        if ((mapRef.current as any)._leaflet_id) return;

        const map = L.map(mapRef.current as HTMLElement).setView([job.lat!, job.lng!], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const blueIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        // Apply the icon to the Job Location marker
        L.marker([job.lat!, job.lng!], { icon: blueIcon })
          .addTo(map)
          .bindPopup('<b>Job Location</b>')
          .openPopup();

        if (userLocation) {
          const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          const addressText = (userLocation.hasStoredLocation && userLocation.address) 
            ? userLocation.address 
            : "no user location";

          L.marker([userLocation.lat, userLocation.lng], { icon: redIcon })
            .addTo(map)
            .bindPopup(`<b>Your Location</b><br/>${addressText}`);
          
          const bounds = L.latLngBounds([[job.lat!, job.lng!], [userLocation.lat, userLocation.lng]]);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      });
    }
  }, [loading, job, userLocation]);

  const handleAcceptJob = async () => {
    if (!user) return router.push("/auth");
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: user.id, workerLat: userLocation?.lat, workerLng: userLocation?.lng })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to accept");
      fetchJob();
      window.dispatchEvent(new Event("job-status-changed")); // NEW
    } catch (err: any) { alert(err.message || "Could not accept job."); }
  };

  const handleCancelJob = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: user?.id })
      });
      if (!res.ok) throw new Error("Failed to cancel");
      fetchJob();
      window.dispatchEvent(new Event("job-status-changed")); // NEW
    } catch (err) { alert("Could not cancel job."); }
  };

  const handleCompleteJob = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to complete");
      fetchJob();
      window.dispatchEvent(new Event("job-status-changed")); // NEW
    } catch (err) { alert("Could not complete job."); }
  };

  const handleApproveJob = async () => {
    if (!window.confirm("Approve and release funds?")) return;
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve");
      alert("Job approved! Funds released.");
      router.push("/jobs");
    } catch (err) { alert("Could not approve job."); }
  };

  const handleRejectJob = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reject");
      fetchJob();
    } catch (err) { alert("Could not reject job."); }
  };

  if (loading) return <div className="p-10 text-center">Loading job details...</div>;
  if (!job) return <div className="p-10 text-center">Job not found.</div>;

  const isPoster = user?.id === job.seekerId;
  const isWorker = user?.id === job.workerId;
  const isExpired = new Date(job.expiryDate) < new Date();
  const dist = (job.lat && job.lng && userLocation) ? calculateDistance(userLocation.lat, userLocation.lng, job.lat, job.lng) : null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
      <button
        onClick={() => router.push("/jobs")}
        className="mb-4 text-sm text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-2 transition-colors"
      >
        ← Back to Jobs
      </button>

      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden p-6">
        {/* Header Section with Price and Action Buttons */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <h1 className="text-3xl font-bold mb-3">{job.title}</h1>
            <div className="flex items-center gap-3">
              <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-semibold uppercase tracking-wider">
                {job.type.replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
                {job.status}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500 font-medium">
              {dist && <span className="text-blue-600 dark:text-blue-400">• {dist.toFixed(1)} km away</span>}
              {job.radius && <span>• Max Radius: {job.radius} km</span>}
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-3">
            <span className="block text-3xl font-bold text-green-600 dark:text-green-400">
              ${job.price.toFixed(2)}
            </span>
            
            {/* Conditional Action Buttons moved under payment */}
            <div className="flex flex-col gap-2 w-full min-w-40">
              {job.status === 'OPEN' && !isPoster && !isExpired && (
                hasActiveJob ? (
                  <button disabled className="w-full px-6 py-2.5 text-sm rounded-md font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-sm border border-zinc-300 dark:border-zinc-700">
                    You have an active job
                  </button>
                ) : (
                  <button onClick={handleAcceptJob} className="w-full px-6 py-2.5 text-sm rounded-md font-bold bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-colors shadow-sm">
                    Accept Job
                  </button>
                )
              )}
              {job.status === 'ACCEPTED' && isWorker && (
                <>
                  <button onClick={handleCompleteJob} className="w-full px-6 py-2.5 text-sm rounded-md font-bold bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:opacity-90">
                    Mark Complete
                  </button>
                  <button onClick={handleCancelJob} className="text-xs text-red-500 hover:underline transition-colors mt-1">
                    Cancel Job
                  </button>
                </>
              )}
              {job.status === 'AWAITING_EVALUATION' && isPoster && (
                <div className="flex flex-col gap-2 w-full">
                  <button onClick={handleApproveJob} className="w-full px-6 py-2.5 text-sm rounded-md font-bold bg-green-600 text-white hover:bg-green-700">
                    Approve & Pay
                  </button>
                  <button onClick={handleRejectJob} className="w-full px-6 py-2.5 text-sm rounded-md font-bold bg-red-100 text-red-600 hover:bg-red-200">
                    Needs Work
                  </button>
                </div>
              )}
              {isPoster && job.status === 'OPEN' && (
                <button onClick={() => router.push(`/jobs/modify/${job.id}`)} className="w-full px-6 py-2.5 text-sm rounded-md font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  Modify Posting
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Grid: Description & Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-gray-100 dark:border-gray-900 pt-8">
          <div className="lg:col-span-4 space-y-6">
            <div>
              <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-widest mb-3">Description</h3>
              <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap italic bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-lg border border-zinc-100/50 dark:border-zinc-800/50">
                "{job.description}"
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm bg-gray-50 dark:bg-zinc-900/50 p-5 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-800 pb-2.5">
                <span className="text-zinc-500">Posted By</span>
                <div className="flex items-center gap-2">
                  {job.seeker ? (
                    <Link 
                      href={`/users/${job.seeker.id}`}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                    >
                      {job.seeker.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">Unknown</span>
                  )}
                  {job.seeker && job.seeker.seekerReviewCount !== undefined && (
                    <span className="text-amber-500 text-xs font-medium flex items-center" title={`${job.seeker.seekerReviewCount} Reviews`}>
                      ★ {job.seeker.seekerRating?.toFixed(1) || "0.0"} <span className="text-zinc-400 ml-1">({job.seeker.seekerReviewCount})</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-800 pb-2.5">
                <span className="text-zinc-500">Work Starts</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatJobDate(job.startDate, job.timezone)}
                </span>
              </div>

              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-800 pb-2.5">
                <span className="text-zinc-500">Deadline</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatJobDate(job.expiryDate, job.timezone)}
                </span>
              </div>

              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-800 pb-2.5">
                <span className="text-zinc-500">Timezone</span>
                <span className="font-medium text-[11px] text-zinc-600 dark:text-zinc-400 text-right">
                  {/* Mapping the value to the label from the shared lib */}
                  {COMMON_TIMEZONES.find(tz => tz.value === job.timezone)?.label || job.timezone}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Location</span>
                <span className="font-semibold text-right">{job.address || 'Location Hidden'}</span>
              </div>
            </div>
          </div>

          {/* Enlarged Map Section */}
          <div className="lg:col-span-8">
            <div className="w-full h-130 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative shadow-inner">
              {job.lat && job.lng ? (
                <div ref={mapRef} className="w-full h-full z-0" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-500">Location data unavailable</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}