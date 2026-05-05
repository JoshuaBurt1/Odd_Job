//web/src/app/jobs/modify/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchGeocode } from "@/lib/geocoding";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import { JOB_CATEGORIES } from "@/lib/jobTypes";

export default function ModifyJobPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [postError, setPostError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAddressValid, setIsAddressValid] = useState(true);
  const [hasPropertyNumber, setHasPropertyNumber] = useState(true);

  // Setup initial dates to prevent controlled/uncontrolled input warnings
  const [formData, setFormData] = useState({
    title: "",
    type: "DECK_FENCE_BUILDING",
    description: "",
    price: "",
    startDate: "",
    expiryDate: "",
    timezone: "UTC",
    address: "",
    radius: "10",
    seekerId: "",
  });

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/auth");
    } else {
      setUser(JSON.parse(storedUser));
    }

    // Fetch existing job data
    fetch(`http://localhost:4000/api/jobs/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Job not found");
        return res.json();
      })
      .then((data) => {
        setFormData({
          title: data.title,
          type: data.type,
          description: data.description,
          price: data.price.toString(),
          // slice(0, 16) is required for <input type="datetime-local" /> format: YYYY-MM-DDTHH:mm
          startDate: new Date(data.startDate).toISOString().slice(0, 16),
          expiryDate: new Date(data.expiryDate).toISOString().slice(0, 16),
          timezone: data.timezone || "UTC",
          address: data.address || "",
          radius: data.radius ? data.radius.toString() : "10",
          seekerId: data.seekerId,
        });

        if (data.lat && data.lng) {
          setUserLocation({ lat: data.lat, lng: data.lng });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setPostError("Failed to load job details.");
        setLoading(false);
      });
  }, [id, router]);

  const handleGeocode = async (query: string, isManualLocate = false) => {
    if (!query) return;
    setIsGeocoding(true);
    try {
      const result = await fetchGeocode(query);
      if (result) {
        setUserLocation({ lat: result.lat, lng: result.lng });
        setIsAddressValid(true);
        setHasPropertyNumber(result.hasPropertyNumber);
        
        // Update: Overwrite with formatted API string for both Verify and Locate
        setFormData(prev => ({ ...prev, address: result.formatted }));
      } else {
        setIsAddressValid(false);
        setUserLocation(null);
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const getUserLocation = () => {
    if ("geolocation" in navigator) {
      setIsGeocoding(true);
      navigator.geolocation.getCurrentPosition((pos) => {
        handleGeocode(`${pos.coords.latitude},${pos.coords.longitude}`, true);
      }, () => setIsGeocoding(false));
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError("");

    // Simple validation consistent with PostPage
    if (new Date(formData.expiryDate) <= new Date(formData.startDate)) {
      return setPostError("Expiry date must be after the start date.");
    }

    try {
      const response = await fetch(`http://localhost:4000/api/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          radius: parseFloat(formData.radius),
          lat: userLocation?.lat || null,
          lng: userLocation?.lng || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update job.");
      router.push("/jobs");
    } catch (error: any) {
      setPostError(error.message);
    }
  };

  const handleDeleteJob = async () => {
    if (!user?.id || user.id !== formData.seekerId) return;
    if (!window.confirm("Are you sure you want to delete this job? This action cannot be undone.")) return;

    setPostError("");
    try {
      const response = await fetch(`http://localhost:4000/api/jobs/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete job.");
      }

      router.push("/jobs");
    } catch (error: any) {
      setPostError(error.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-zinc-500">Loading editor...</div>;

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto w-full">
      <button
        onClick={() => router.push("/jobs")}
        className="mb-6 text-sm text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-2 transition-colors"
      >
        ← Back to Jobs
      </button>

      <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#0a0a0a] shadow-sm">
        <h2 className="text-2xl font-bold mb-6">Modify Posting</h2>
        {postError && <p className="text-red-500 mb-4 text-sm">{postError}</p>}

        <form onSubmit={handleSaveChanges} className="flex flex-col gap-5">
          {/* Job Title */}
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
              Job Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent focus:ring-1 focus:ring-black outline-none"
              placeholder="e.g. Clean up my front yard"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Selection */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
                Category
              </label>
              <div className="relative group">
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-zinc-900 outline-none appearance-none pr-10 focus:ring-2 focus:ring-zinc-500/20 transition-all cursor-pointer"
                >
                  <option value="" disabled>Select a service...</option>
                  {JOB_CATEGORIES.map((cat) => (
                    <optgroup key={cat.label} label={cat.label} className="bg-gray-100 dark:bg-zinc-800 font-bold">
                      {cat.options.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 font-normal">
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-zinc-500 group-hover:text-zinc-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Bounty Amount */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
                Bounty ($)
              </label>
              <input 
                type="number" 
                min="1" 
                step="0.01" 
                required 
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-zinc-500/20 transition-all"
                placeholder="50.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
                Start Date
              </label>
              <input
                type="datetime-local"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
                Expiry Date
              </label>
              <input
                type="datetime-local"
                required
                value={formData.expiryDate}
                min={formData.startDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none"
              />
            </div>

            {/* Timezone Selection */}
            <div className="mt-1">
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
                Job Timezone
              </label>
              <div className="relative group">
                <select 
                  value={formData.timezone}
                  onChange={e => setFormData({...formData, timezone: e.target.value})}
                  className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-zinc-900 outline-none appearance-none pr-10 focus:ring-2 focus:ring-zinc-500/20 transition-all cursor-pointer"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                  {/* Fallback for the auto-detected zone if not in the common list */}
                  {!COMMON_TIMEZONES.some(tz => tz.value === formData.timezone) && (
                    <option value={formData.timezone}>{formData.timezone} (Detected)</option>
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-zinc-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Times will be displayed to workers in this timezone.</p>
            </div>
          </div>

          {/* Address & Geocoding */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">Address</label>
              <button 
                type="button"
                onClick={getUserLocation}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 uppercase tracking-tight transition-colors"
                disabled={isGeocoding}
              >
                <span className="text-xs">📍</span> Use My Location
              </button>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" value={formData.address}
                onChange={e => {
                  setFormData({...formData, address: e.target.value});
                  setIsAddressValid(false); // Reset validation on change
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleGeocode(formData.address);
                  }
                }}
                className={`flex-1 p-3 text-sm border ${!isAddressValid && formData.address ? 'border-amber-500' : 'border-gray-300'} rounded-md bg-transparent outline-none`}
                placeholder="Enter job location"
              />
              <button 
                type="button" 
                onClick={() => handleGeocode(formData.address)} 
                disabled={isGeocoding || !formData.address}
                className="px-4 py-2 bg-zinc-900 text-white rounded-md text-xs font-semibold
                          transition-all duration-200 ease-in-out
                          hover:bg-zinc-700 active:bg-zinc-800 active:scale-95
                          disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed
                          focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-1"
              >Verify</button>
            </div>
            
            {/* Validation Feedback */}
            {isAddressValid && !hasPropertyNumber && (
              <p className="text-[10px] text-amber-600 mt-1">⚠️ Accuracy warning: House number not detected by map provider.</p>
            )}
            {isAddressValid && <p className="text-[10px] text-emerald-500 mt-1">✓ Location Verified</p>}

            <div className="flex gap-4 mt-3">
              <div className="flex-1">
                <label className="block text-[10px] font-medium mb-1 uppercase tracking-wider text-zinc-400">
                  Latitude
                </label>
                <input
                  type="number"
                  readOnly
                  value={userLocation?.lat || ""}
                  className="w-full p-2 text-xs border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-500 outline-none"
                  placeholder="Auto-populated"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-medium mb-1 uppercase tracking-wider text-zinc-400">
                  Longitude
                </label>
                <input
                  type="number"
                  readOnly
                  value={userLocation?.lng || ""}
                  className="w-full p-2 text-xs border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-500 outline-none"
                  placeholder="Auto-populated"
                />
              </div>
            </div>
          </div>

          {/* Radius Limit */}
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
              Worker Radius Limit (km)
            </label>
            <input
              type="number"
              min="1"
              value={formData.radius}
              onChange={(e) => setFormData({ ...formData, radius: e.target.value })}
              className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none"
              placeholder="e.g. 15"
            />
            <p className="text-[10px] text-zinc-400 mt-1">
              Workers outside this range cannot apply.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
              Description
            </label>
            <textarea
              required
              rows={5}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none resize-none"
              placeholder="Describe tools required, timeframe, etc."
            />
          </div>

          <div className="flex gap-4 mt-2">
            <button
              type="submit"
              className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 text-sm rounded-md font-bold hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
            {user?.id === formData.seekerId && (
              <button
                type="button"
                onClick={handleDeleteJob}
                className="flex-1 bg-red-600 dark:bg-red-700 text-white py-3 text-sm rounded-md font-bold hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
              >
                Delete Job
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}