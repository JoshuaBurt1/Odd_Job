//web/src/app/jobs/modify/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchGeocode } from "@/lib/geocoding";

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
    type: "TRASH_CLEANUP",
    description: "",
    price: "",
    startDate: "",
    expiryDate: "",
    address: "",
    radius: "10",
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
          address: data.address || "",
          radius: data.radius ? data.radius.toString() : "10",
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
            {/* Category */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">
                Category
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none appearance-none"
              >
                <option value="TRASH_CLEANUP">Trash Cleanup</option>
                <option value="HOME_GARDEN_CLEANUP">Home & Garden Cleanup</option>
                <option value="GRASS_CUTTING">Grass Cutting</option>
                <option value="DECK_FENCE_BUILDING">Deck & Fence Building</option>
                <option value="GARDEN_TENDING">Garden Tending</option>
                <option value="CROP_PICKING">Crop Picking</option>
              </select>
            </div>

            {/* Bounty */}
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
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none"
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

          <button
            type="submit"
            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 text-sm rounded-md font-bold hover:opacity-90 transition-opacity mt-2"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}