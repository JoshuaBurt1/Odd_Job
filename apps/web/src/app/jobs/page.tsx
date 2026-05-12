// web/src/app/jobs/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchGeocode } from "../../lib/geocoding";
import FormattedJobDate from "@/components/FormattedJobDate";
import JobsSidebar from "@/components/JobsSidebar";

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
      target.setDate(target.getDate() + 1);
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
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        
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
  const R = 6371; 
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
  const [showWarmingUp, setShowWarmingUp] = useState(false);
  const [user, setUser] = useState<{id: string, name: string} | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // Geolocation State
  const [userLocation, setUserLocation] = useState({ lat: 44.3879, lng: -79.6907, name: "Barrie (Default)" });
  const [locationSource, setLocationSource] = useState<"DEFAULT" | "PROFILE" | "GPS" | "MANUAL" | "SAVED">("DEFAULT");
  const [addressInput, setAddressInput] = useState("");
  const [locErrorMsg, setLocErrorMsg] = useState("");

  const [filterRadius, setFilterRadius] = useState<number>(100);
  const [minPayment, setMinPayment] = useState<number>(0);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://odd-job-ke1z.onrender.com";

  const fetchJobs = (currentUser: {id: string} | null = user) => {
    setLoading(true);
    const url = currentUser
      ? `${API_BASE}/api/jobs?userId=${currentUser.id}`
      : `${API_BASE}/api/jobs`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setJobs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch jobs", err);
        setJobs([]); 
        setLoading(false);
      });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handlePostJobClick = async () => {
    if (!user) return router.push("/auth");

    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}/can-post`, {
        method: "GET",
        headers: { "x-user-id": user.id }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Action denied.");
      }
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
      localStorage.setItem("lastLocation", JSON.stringify(newLoc)); 
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
          localStorage.setItem("lastLocation", JSON.stringify(newLoc)); 
          setLocErrorMsg("");
        },
        () => setLocErrorMsg("Geolocation failed or was denied.")
      );
    } else {
      setLocErrorMsg("Geolocation is not supported by your browser.");
    }
  };

  // Warning up timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setShowWarmingUp(true);
      }, 5000);
    } else {
      setShowWarmingUp(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    let currentUser = null;
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      setUser(currentUser);
    }
    fetchJobs(currentUser);

    const storedLoc = localStorage.getItem("lastLocation");
    if (storedLoc) {
      setUserLocation(JSON.parse(storedLoc));
      setLocationSource("SAVED");
    } else {
      const fetchProfileLocation = (userId: string) => {
        fetch(`${API_BASE}/api/users/${userId}/profile`)
          .then((res) => res.json())
          .then((data) => {
            if (data.userLat && data.userLong) {
              const profileLoc = { lat: data.userLat, lng: data.userLong, name: data.address || "Your Profile Location" };
              setUserLocation(profileLoc);
              setLocationSource("PROFILE");
              localStorage.setItem("lastLocation", JSON.stringify(profileLoc)); 
            }
          })
          .catch((err) => console.error("Failed to fetch profile location", err));
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const gpsLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Device GPS Location" };
            setUserLocation(gpsLoc);
            setLocationSource("GPS");
            localStorage.setItem("lastLocation", JSON.stringify(gpsLoc));
          },
          () => {
            if (currentUser) fetchProfileLocation(currentUser.id);
          }
        );
      } else if (currentUser) {
        fetchProfileLocation(currentUser.id);
      }
    }
  }, []); 

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
          const userOwnsExpiredJob = jobs.some(
            (job) => data.ids.includes(job.id) && job.seekerId === user?.id
          );
          if (userOwnsExpiredJob) {
            fetchJobs();
          } else {
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
    // 1. Helper to determine individual job rank
    const getRank = (job: Job) => {
      if (user && job.seekerId === user.id && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(job.status)) return 1;
      if (user && job.seekerId === user.id && job.status === 'OPEN') return 2;
      if (user && job.workerId === user.id && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(job.status)) return 3;
      return 4;
    };

    // 2. Build a map of categories with their best rank
    const categoryMap: Record<string, { category: string; jobs: Job[]; topRank: number }> = {};

    jobs.forEach(job => {
      const isRelated = user && (job.seekerId === user.id || job.workerId === user.id);
      
      let distance = 0;
      if (job.lat && job.lng) {
        distance = calculateDistance(userLocation.lat, userLocation.lng, job.lat, job.lng);
        job.distance = distance;
        
        if (!isRelated) {
          if (job.radius && distance > job.radius) return;
          if (distance > filterRadius) return;
        }
      }

      if (!isRelated && minPayment > 0 && job.price < minPayment) return;

      const rank = getRank(job);

      if (!categoryMap[job.type]) {
        categoryMap[job.type] = { category: job.type, jobs: [], topRank: rank };
      }

      // Update the category's overall priority if this job is higher priority (lower number)
      if (rank < categoryMap[job.type].topRank) {
        categoryMap[job.type].topRank = rank;
      }

      categoryMap[job.type].jobs.push(job);
    });

    // 3. Convert to Array and Sort the Categories
    const sortedCategories = Object.values(categoryMap).sort((a, b) => {
      // Primary sort: Category with the most important job (lowest topRank) comes first
      if (a.topRank !== b.topRank) return a.topRank - b.topRank;
      // Secondary sort: Alphabetical
      return a.category.localeCompare(b.category);
    });

    // 4. Sort the jobs inside each category (Distance/Date)
    sortedCategories.forEach(cat => {
      cat.jobs.sort((a, b) => {
        const rankA = getRank(a);
        const rankB = getRank(b);
        if (rankA !== rankB) return rankA - rankB;

        const distA = a.distance ?? Infinity;
        const distB = b.distance ?? Infinity;
        if (distA !== distB) return distA - distB;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });

    return sortedCategories;
  };

  const groupedJobs = groupAndSortJobs();

  const renderJobActions = (job: Job) => {
    const isPoster = user?.id === job.seekerId;
    const now = new Date();
    const expiryDate = new Date(job.expiryDate);
    const isExpired = expiryDate < now;

    const btnBase = "px-4 py-1.5 text-xs rounded-md font-bold transition-all shadow-sm";
    const btnSecondary = `${btnBase} bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700`;
    const btnPrimary = `${btnBase} bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500`;
    const btnDanger = `${btnBase} bg-white dark:bg-zinc-900 text-red-600 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20`;

    if (isPoster) {
      if (job.status === 'AWAITING_EVALUATION') {
        return (
          <div className="flex flex-col items-end gap-2">
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
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* LEFT COLUMN: The New Sidebar */}
        <div className="md:col-span-1">
          <JobsSidebar
            userLocation={userLocation}
            locationSource={locationSource}
            filterRadius={filterRadius}
            setFilterRadius={setFilterRadius}
            minPayment={minPayment}
            setMinPayment={setMinPayment}
            addressInput={addressInput}
            setAddressInput={setAddressInput}
            handleGeocode={handleGeocode}
            handleGeolocation={handleGeolocation}
            locErrorMsg={locErrorMsg}
            user={user}
            handlePostJobClick={handlePostJobClick}
            handleSignInClick={() => router.push("/auth")}
          />
        </div>

        {/* RIGHT COLUMN: The Job List */}
        <div className="md:col-span-3">
          {loading ? (
            <div className="flex flex-col gap-2 items-center justify-center py-20 text-zinc-500">
              <p>Loading jobs...</p>
              {showWarmingUp && (
                <p className="text-slate-500 text-sm font-medium animate-pulse mt-2 bg-slate-50 dark:bg-slate-900/20 px-3 py-1 rounded">
                  Server warming up
                </p>
              )}
            </div>
          ) : groupedJobs.length === 0 ? (
            <p className="text-zinc-500">No jobs available right now matching your filters.</p>
          ) : (
            <div className="space-y-6">
              {/* Updated .map to handle the array structure */}
              {groupedJobs.map(({ category, jobs: categoryJobs }) => {
                const isExpanded = expandedCategories[category] === true;

                return (
                  <div key={category} className="border-b border-gray-100 dark:border-zinc-900 pb-4">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex justify-between items-center group py-2"
                    >
                      <h2 className="text-xl font-bold capitalize tracking-tight group-hover:text-blue-500 transition-colors">
                        {category.replace(/_/g, ' ').toLowerCase()}
                        <span className="ml-3 text-xs font-normal text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                          {categoryJobs.length}
                        </span>
                      </h2>
                      <svg 
                        className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="flex flex-col gap-2 w-full mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
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

                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-50 dark:border-zinc-900/50 text-[9px] uppercase tracking-tight font-medium text-zinc-500">
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <FormattedJobDate 
                                  label="Posted:" 
                                  date={job.createdAt} 
                                  timezone={job.timezone} 
                                  className="flex gap-1"
                                />
                                <FormattedJobDate 
                                  label="Starts:" 
                                  date={job.startDate} 
                                  timezone={job.timezone} 
                                  className="flex gap-1"
                                />
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
                                      {job.seeker.name.length > 15 
                                        ? `${job.seeker.name.substring(0, 15)}...` 
                                        : job.seeker.name}
                                    </Link>
                                  ) : (
                                    job.seeker?.name 
                                      ? (job.seeker.name.length > 15 ? `${job.seeker.name.substring(0, 15)}...` : job.seeker.name)
                                      : 'Unknown'
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}