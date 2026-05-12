// web/src/components/JobsSidebar.tsx
"use client";

interface JobsSidebarProps {
  userLocation: { lat: number; lng: number; name: string };
  locationSource: string;
  filterRadius: number;
  setFilterRadius: (val: number) => void;
  minPayment: number;
  setMinPayment: (val: number) => void;
  addressInput: string;
  setAddressInput: (val: string) => void;
  handleGeocode: () => void;
  handleGeolocation: () => void;
  locErrorMsg: string;
  user: { id: string; name: string } | null;
  handlePostJobClick: () => void;
  handleSignInClick: () => void;
}

export default function JobsSidebar({
  userLocation,
  locationSource,
  filterRadius,
  setFilterRadius,
  minPayment,
  setMinPayment,
  addressInput,
  setAddressInput,
  handleGeocode,
  handleGeolocation,
  locErrorMsg,
  user,
  handlePostJobClick,
  handleSignInClick,
}: JobsSidebarProps) {
  return (
    <div className="p-5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-[#111] flex flex-col gap-8 sticky top-6">
      
      {/* Action Buttons */}
      <div>
        {user ? (
          <button
            onClick={handlePostJobClick}
            className="w-full bg-foreground text-background px-4 py-3 text-sm rounded-lg font-bold hover:opacity-90 transition-opacity"
          >
            + Post a Job
          </button>
        ) : (
          <button
            onClick={handleSignInClick}
            className="w-full border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            Sign in to Post
          </button>
        )}
      </div>

      <hr className="border-gray-200 dark:border-gray-800" />

      {/* Unified Location Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Location</h3>
        
        <div>
          <p className="font-bold text-base leading-tight mb-1">{userLocation.name}</p>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-zinc-500 font-mono">
              Lat: {userLocation.lat.toFixed(4)} | Lng: {userLocation.lng.toFixed(4)}
            </p>
            <span className="text-[11px] font-semibold">
              {locationSource === "GPS" && <span className="text-green-600 dark:text-green-400">📍 Location Services</span>}
              {locationSource === "MANUAL" && <span className="text-blue-600 dark:text-blue-400">🏠 User Entered Address</span>}
              {locationSource === "PROFILE" && <span className="text-purple-600 dark:text-purple-400">👤 Profile Default</span>}
              {locationSource === "SAVED" && <span className="text-amber-600 dark:text-amber-400">💾 Saved Location</span>}
              {locationSource === "DEFAULT" && <span className="text-gray-500 dark:text-gray-400">🌐 System Default</span>}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm"
            placeholder="Enter new address..."
          />
          <button
            type="button"
            onClick={handleGeocode}
            className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-sm font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Verify Address
          </button>
        </div>

        <div className="flex items-center justify-center text-[10px] text-gray-500 font-bold tracking-widest">OR</div>
        
        <button
          type="button"
          onClick={handleGeolocation}
          className="w-full px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-sm font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          📍 Use My GPS
        </button>

        {locErrorMsg && (
          <p className="text-xs text-red-600 dark:text-red-400 text-center">{locErrorMsg}</p>
        )}
      </div>

      <hr className="border-gray-200 dark:border-gray-800" />

      {/* Filters Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Filters</h3>
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Search Radius (km)
          </label>
          <input
            type="number"
            min="1"
            max="5000"
            value={filterRadius}
            onChange={(e) => setFilterRadius(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Minimum Payment ($)
          </label>
          <input
            type="number"
            min="0"
            value={minPayment || ""}
            onChange={(e) => setMinPayment(Number(e.target.value))}
            placeholder="e.g. 50"
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm"
          />
        </div>
      </div>
    </div>
  );
}