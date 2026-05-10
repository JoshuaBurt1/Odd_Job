// web/src/app/jobs/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchGeocode } from "../../lib/geocoding";
import FormattedJobDate from "@/components/FormattedJobDate";

type Job = {
  id: string;
  title: string;
  type: string;
  description: string;
  price: number;
  status: string;
  timezone: string;
  startDate: string;
  expiryDate: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
  distance?: number;
  seekerId: string;
  seeker?: { 
    id: string;
    name: string;
    seekerRating?: number;
    seekerReviewCount?: number;
  } | null;
  workerId?: string | null;
  worker?: { name: string } | null;
  createdAt: string;
  evaluationStartedAt?: string | null;
};

const PaymentTimer = ({ evaluationStartedAt }: { evaluationStartedAt: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");

  useEffect(() => {
    if (!evaluationStartedAt) return;

    const getTargetDate = () => {
      const target = new Date(evaluationStartedAt);
      // Add 1 day to target the following day's midnight (effectively the next calendar day's end)
      target.setDate(target.getDate() + 0);
      target.setHours(23, 59, 59, 999);
      return target;
    };

    const targetTime = getTargetDate().getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetTime - now;

      if (distance <= 0) {
        setTimeLeft("Processing Auto-Pay...");
        clearInterval(interval);
      } else {
        // 1. Calculate total days remaining
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        // 2. Extract remaining hours, minutes, and seconds
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        
        // 3. Display the days component if the distance is greater than 24 hours
        if (d > 0) {
          setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
        } else {
          setTimeLeft(`${h}h ${m}m ${s}s`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [evaluationStartedAt]);

  return <span className="font-mono tracking-tight">{timeLeft}</span>;
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{id: string, name: string} | null>(null);
  
  // Geolocation State
  const [userLocation, setUserLocation] = useState({ lat: 43.6548, lng: -79.3884, name: "Toronto (Default)" });
  const [locationSource, setLocationSource] = useState<"DEFAULT" | "PROFILE" | "GPS" | "MANUAL" | "SAVED">("DEFAULT");
  const [addressInput, setAddressInput] = useState("");
  const [locErrorMsg, setLocErrorMsg] = useState("");

  const [filterRadius, setFilterRadius] = useState<number>(50);
  const [isRadiusFilterActive, setIsRadiusFilterActive] = useState<boolean>(false);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://odd-job-ke1z.onrender.com";

  const fetchJobs = (currentUser: {id: string} | null = user) => {
    setLoading(true);
    const url = currentUser
      ? `${API_BASE}/api/jobs?userId=${currentUser.id}`
      : `${API_BASE}/api/jobs`; // Also fixed the string interpolation here

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        // FIX: Ensure data is an array. If server sends { error: "..." }, use empty array.
        setJobs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch jobs", err);
        setJobs([]); // Reset to empty array on error to prevent crash
        setLoading(false);
      });
  };

  const handlePostJobClick = async () => {
    if (!user) return router.push("/auth");

    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}/can-post`, {
        method: "GET",
        headers: { "x-user-id": user.id }
      });

      // If the middleware (or server) blocked this, grab the message and throw
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Action denied.");
      }

      // Success! Proceed to the posting page
      router.push("/jobs/post");
    } catch (err: any) {
      alert(err.message || "Could not verify posting permissions.");
    }
  };

  const handleGeocode = async () => {
    if (!addressInput) return;
    const res = await fetchGeocode(addressInput);
    if (res) {
      const newLoc = { lat: res.lat, lng: res.lng, name: res.formatted };
      setUserLocation(newLoc);
      setLocationSource("MANUAL");
      localStorage.setItem("lastLocation", JSON.stringify(newLoc)); // Save instantly
      setLocErrorMsg("");
      setAddressInput("");
    } else {
      setLocErrorMsg("Could not find coordinates for this address.");
    }
  };

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Device GPS Location" };
          setUserLocation(newLoc);
          setLocationSource("GPS");
          localStorage.setItem("lastLocation", JSON.stringify(newLoc)); // Save instantly
          setLocErrorMsg("");
        },
        () => setLocErrorMsg("Geolocation failed or was denied.")
      );
    } else {
      setLocErrorMsg("Geolocation is not supported by your browser.");
    }
  };

  // Initialization Effect: Load User, Jobs, and Location efficiently
  useEffect(() => {
    // 1. Load User & Fetch Jobs
    const storedUser = localStorage.getItem("user");
    let currentUser = null;
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      setUser(currentUser);
    }
    fetchJobs(currentUser);

    // 2. Resolve Location Hierarchy: LocalStorage -> GPS -> Profile
    const storedLoc = localStorage.getItem("lastLocation");
    
    if (storedLoc) {
      // Fast path: Load from local storage
      setUserLocation(JSON.parse(storedLoc));
      setLocationSource("SAVED");
    } else {
      // Helper function for profile fallback
      const fetchProfileLocation = (userId: string) => {
        fetch(`${API_BASE}/api/users/${userId}/profile`)
          .then((res) => res.json())
          .then((data) => {
            if (data.userLat && data.userLong) {
              const profileLoc = { lat: data.userLat, lng: data.userLong, name: data.address || "Your Profile Location" };
              setUserLocation(profileLoc);
              setLocationSource("PROFILE");
              localStorage.setItem("lastLocation", JSON.stringify(profileLoc)); // Cache it for next time
            }
          })
          .catch((err) => console.error("Failed to fetch profile location", err));
      };

      // Try GPS first if supported
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const gpsLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Device GPS Location" };
            setUserLocation(gpsLoc);
            setLocationSource("GPS");
            localStorage.setItem("lastLocation", JSON.stringify(gpsLoc));
          },
          () => {
            // GPS Denied: Fallback to profile if user is logged in
            if (currentUser) fetchProfileLocation(currentUser.id);
          }
        );
      } else if (currentUser) {
        // No GPS Support: Fallback to profile
        fetchProfileLocation(currentUser.id);
      }
    }
  }, []); // Empty dependency array ensures this single-pass initialization only runs on mount

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eventSource = new EventSource(`${API_BASE}/api/jobs/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "REFRESH_JOBS") {
          fetchJobs();
        } 
        
        else if (data.type === "REMOVE_JOBS") {
          console.log("🧹 Live cleanup: Removing expired jobs from feed", data.ids);
          
          // Check if the logged-in user is the poster of any of the expiring jobs.
          const userOwnsExpiredJob = jobs.some(
            (job) => data.ids.includes(job.id) && job.seekerId === user?.id
          );

          if (userOwnsExpiredJob) {
            fetchJobs(); // Re-fetch to apply and show the red "⚠️ Hidden due to expiry" box
          } else {
            // For everyone else, just slide the jobs out of state instantly
            setJobs((prevJobs) => prevJobs.filter((job) => !data.ids.includes(job.id)));
          }
        }
      } catch (err) {
        console.error("SSE Parse Error:", err);
      }
    };
    
    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, [jobs, user]);

  const groupAndSortJobs = () => {
    const grouped: Record<string, Job[]> = {};
    
    jobs.forEach(job => {
      const isRelated = user && (job.seekerId === user.id || job.workerId === user.id);
      
      let distance = 0;
      if (job.lat && job.lng) {
        distance = calculateDistance(userLocation.lat, userLocation.lng, job.lat, job.lng);
        job.distance = distance;
        
        if (!isRelated) {
          // Rule: Hide if distance exceeds job's own radius limit
          if (job.radius && distance > job.radius) return;

          // Rule: Hide if user's manual filter is active and distance exceeds it
          if (isRadiusFilterActive && distance > filterRadius) return;
        }
      }

      if (!grouped[job.type]) grouped[job.type] = [];
      grouped[job.type].push(job);
    });

    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        const getRank = (job: Job) => {
          if (user && job.seekerId === user.id && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(job.status)) return 1;
          if (user && job.seekerId === user.id && job.status === 'OPEN') return 2;
          if (user && job.workerId === user.id && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(job.status)) return 3;
          return 4;
        };
        const rankA = getRank(a);
        const rankB = getRank(b);
        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });

    return grouped;
  };

  const groupedJobs = groupAndSortJobs();

  const renderJobActions = (job: Job) => {
    const isPoster = user?.id === job.seekerId;
    const now = new Date();
    const expiryDate = new Date(job.expiryDate);
    const isExpired = expiryDate < now;

    // Shared button styles to ensure consistency
    const btnBase = "px-4 py-1.5 text-xs rounded-md font-bold transition-all shadow-sm";
    const btnSecondary = `${btnBase} bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700`;
    const btnPrimary = `${btnBase} bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500`;
    const btnDanger = `${btnBase} bg-white dark:bg-zinc-900 text-red-600 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20`;

    if (isPoster) {
      if (job.status === 'AWAITING_EVALUATION') {
        return (
          <div className="flex flex-col items-end gap-2">
            {/* Standardized Timer Badge */}
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-md border border-orange-200 dark:border-orange-800/50 text-orange-800 dark:text-orange-300">
              <svg className="w-3.5 h-3.5 animate-pulse shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] font-bold whitespace-nowrap">AUTO-PAY:</span>
              <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                <PaymentTimer evaluationStartedAt={job.evaluationStartedAt!} />
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE}/api/jobs/${job.id}/reject`, { method: "POST" });
                  } catch (err) {
                    console.error("Failed to request improvement", err);
                  }
                }}
                className={btnDanger}
              >
                Needs Improvement
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE}/api/jobs/${job.id}/approve`, { method: "POST" });
                  } catch (err) {
                    console.error("Failed to approve and pay", err);
                  }
                }}
                className={btnPrimary}
              >
                Approve Payment
              </button>
            </div>
          </div>
        );
      }

      if (isExpired && job.status === 'OPEN') {
        const diffMs = now.getTime() - expiryDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, 7 - diffDays);
        return (
          <div className="flex flex-col items-end gap-2">
            <div className="px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-800/50">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-tight">
                ⚠️ Expired • Deleting in {daysLeft}d
              </p>
            </div>
            <button
              onClick={() => router.push(`/jobs/modify?id=${job.id}`)}
              className={btnSecondary}
            >
              Modify Post
            </button>
          </div>
        );
      }
      
      return (
        <div className="flex items-center">
          <button
            onClick={() => router.push(`/jobs/modify?id=${job.id}`)}
            className={btnSecondary}
          >
            Modify Post
          </button>
        </div>
      );
    }
    
    // Non-poster view (Worker)
    return (
      <div className="flex items-center gap-3">
        {job.status === 'AWAITING_EVALUATION' && job.evaluationStartedAt && (
          <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-md border border-orange-200 dark:border-orange-800/50 text-orange-800 dark:text-orange-300">
            <svg className="w-3.5 h-3.5 animate-pulse shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-bold whitespace-nowrap">AUTO-PAY:</span>
            <span className="text-xs font-black text-orange-600 dark:text-orange-400">
              <PaymentTimer evaluationStartedAt={job.evaluationStartedAt!} />
            </span>
          </div>
        )}
        <button
          onClick={() => {
            if (!user) {
              router.push("/auth");
            } else {
              router.push(`/jobs/view?id=${job.id}`);
            }
          }}
          className={btnSecondary}
        >
          View Posting
        </button>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Open Jobs</h1>
        {user ? (
          <button
            onClick={handlePostJobClick}
            className="bg-foreground text-background px-4 py-2 text-sm rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            + Post a Job
          </button>
        ) : (
          <button
            onClick={() => router.push("/auth")}
            className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm rounded-full font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Sign in to Post
          </button>
        )}
      </div>

      <div className="mb-8 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-[#111] flex flex-col gap-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Current Location</p>
            <p className="font-bold text-lg">{userLocation.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-zinc-500 font-mono">
                Lat: {userLocation.lat.toFixed(4)} | Lng: {userLocation.lng.toFixed(4)}
              </p>
              <span className="text-xs font-semibold ml-2">
                {locationSource === 'GPS' && <span className="text-green-600 dark:text-green-400">📍 Location Services</span>}
                {locationSource === 'MANUAL' && <span className="text-blue-600 dark:text-blue-400">🏠 User Entered Address</span>}
                {locationSource === 'PROFILE' && <span className="text-purple-600 dark:text-purple-400">👤 Profile Default</span>}
                {locationSource === 'SAVED' && <span className="text-amber-600 dark:text-amber-400">💾 Saved Location</span>}
                {locationSource === 'DEFAULT' && <span className="text-gray-500 dark:text-gray-400">🌐 System Default</span>}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto bg-white dark:bg-black p-2 md:p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isRadiusFilterActive}
                onChange={(e) => setIsRadiusFilterActive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              Limit search radius
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={filterRadius}
              onChange={(e) => setFilterRadius(Number(e.target.value))}
              disabled={!isRadiusFilterActive}
              className="border border-gray-300 dark:border-gray-700 rounded p-1 w-16 text-center text-sm dark:bg-[#222] disabled:opacity-50"
            />
            <span className="text-sm font-medium text-zinc-500">km</span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <input 
              type="text" 
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              className="flex-1 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm" 
              placeholder="Enter new address to search..." 
            />
            <button 
              type="button" 
              onClick={handleGeocode}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-sm font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"
            >
              Verify
            </button>
          </div>
          <div className="flex items-center justify-center text-xs text-gray-500 font-medium px-2">OR</div>
          <button 
            type="button" 
            onClick={handleGeolocation}
            className="w-full sm:w-auto px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-sm font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap"
          >
            📍 Use My GPS
          </button>
        </div>
        {locErrorMsg && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{locErrorMsg}</p>
        )}
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading jobs...</p>
      ) : Object.keys(groupedJobs).length === 0 ? (
        <p className="text-zinc-500">No jobs available right now in your area.</p>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedJobs).map(([category, categoryJobs]) => (
            <div key={category}>
              <h2 className="text-xl font-bold mb-4 capitalize border-b border-gray-200 dark:border-gray-800 pb-2">
                {category.replace(/_/g, ' ').toLowerCase()}
              </h2>
              <div className="flex flex-col gap-2 w-full">
                {categoryJobs.map(job => (
                  <div
                    key={job.id}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#0a0a0a] shadow-sm flex flex-col w-full hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm truncate">{job.title}</h3>
                          <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded dark:bg-green-900/30 dark:text-green-400">
                            ${job.price.toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                          <span className="truncate max-w-62.5">📍 {job.address || 'Location Hidden'}</span>
                          {job.distance !== undefined && (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              • {job.distance.toFixed(1)} km away
                            </span>
                          )}
                          {job.radius && (
                            <span className="text-zinc-400">
                              • Max radius: {job.radius} km
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center min-h-10">
                        {renderJobActions(job)}
                      </div>
                    </div>

                    <p className="text-[12px] text-zinc-400 mt-1 line-clamp-1 italic">
                      "{job.description.length > 80 ? `${job.description.substring(0, 80)}...` : job.description}"
                    </p>

                    {/* Replace the old date block with this updated version */}
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-50 dark:border-zinc-900/50 text-[9px] uppercase tracking-tight font-medium text-zinc-500">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {/* 1. Created At (Usually kept in UTC or Job TZ) */}
                        <FormattedJobDate 
                          label="Posted:" 
                          date={job.createdAt} 
                          timezone={job.timezone} 
                          className="flex gap-1"
                        />

                        {/* 2. Start Date */}
                        <FormattedJobDate 
                          label="Starts:" 
                          date={job.startDate} 
                          timezone={job.timezone} 
                          className="flex gap-1"
                        />

                        {/* 3. Expiry Date */}
                        <FormattedJobDate 
                          label="Expires:" 
                          date={job.expiryDate} 
                          timezone={job.timezone} 
                          className="flex gap-1 text-orange-600/80 dark:text-orange-400/80"
                        />
                      </div>

                      <div className="flex gap-3 items-center">
                        <span className="flex items-center gap-1">
                          <strong>Posted By:</strong>{" "}
                          {job.seeker?.id ? (
                            <Link 
                              href={`/public-profile?id=${job.seeker.id}`}
                              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {job.seeker.name.split(' ')[0]}
                            </Link>
                          ) : (
                            job.seeker?.name?.split(' ')[0] || 'Unknown'
                          )}
                          {job.seeker && job.seeker.seekerReviewCount !== undefined && (
                            <span className="text-amber-500 tracking-normal ml-0.5" title={`${job.seeker.seekerReviewCount} Reviews`}>
                              ★ {job.seeker.seekerRating?.toFixed(1) || "0.0"} <span className="text-zinc-400">({job.seeker.seekerReviewCount})</span>
                            </span>
                          )}
                        </span>
                        <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                          {job.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}