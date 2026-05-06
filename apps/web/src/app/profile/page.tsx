// web/src/app/profile/page.tsx

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchGeocode } from "../../lib/geocoding";


type ArchiveJob = {
  id: string;
  title: string;
  price: number;
  completedAt: string;
  worker?: { 
    id: string; 
    name: string; 
  };
  seeker?: { 
    id: string; 
    name: string; 
  };
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  paymentId?: string;
  address?: string;
  userLat?: number;
  userLong?: number;
  seekerRating: number;
  seekerReviewCount: number;
  workerRating: number;
  workerReviewCount: number;
  createdAt: string;
  completedJobs: number;
  earnings: number;
  seekerComplete: ArchiveJob[];
  workerComplete: ArchiveJob[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Location Edit State
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLong, setNewLong] = useState<number | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Payment Edit State
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentInput, setPaymentInput] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    
    if (!storedUser) {
      router.push("/auth");
      return;
    }

    const user = JSON.parse(storedUser);
    window.dispatchEvent(new Event("storage"));

    fetch(`http://localhost:4000/api/users/${user.id}/profile`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setProfile({ ...data, id: user.id });
        setAddressInput(data.address || "");
        setPaymentInput(data.paymentId || "");
        setNewLat(data.userLat || null);
        setNewLong(data.userLong || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch profile", err);
        router.push("/auth"); // Force re-login if profile fetch completely fails
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage")); 
    window.location.href = "/";
  };

  const handleGeocode = async () => {
    if (!addressInput) return;
    setIsGeocoding(true);
    const res = await fetchGeocode(addressInput);
    if (res) {
      setNewLat(res.lat);
      setNewLong(res.lng);
      setAddressInput(res.formatted); 
      setLocationError("");
    } else {
      setLocationError("Could not find coordinates for this address.");
    }
    setIsGeocoding(false);
  };

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNewLat(pos.coords.latitude);
          setNewLong(pos.coords.longitude);
          setAddressInput("Location set via Device GPS");
          setLocationError("");
        },
        () => setLocationError("Geolocation failed or was denied.")
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
  };

  const handleSaveLocation = async () => {
    if (!profile || !newLat || !newLong) {
      setLocationError("Please verify an address or use GPS first.");
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:4000/api/users/${profile.id}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addressInput, userLat: newLat, userLong: newLong })
      });

      if (!response.ok) throw new Error("Failed to update location");
      
      setProfile({ ...profile, address: addressInput, userLat: newLat, userLong: newLong });
      setIsEditingLocation(false);
    } catch (err: any) {
      setLocationError(err.message);
    }
  };

  const handleSavePayment = async () => {
    if (!profile) return;
    try {
      const response = await fetch(`http://localhost:4000/api/users/${profile.id}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: paymentInput })
      });

      if (!response.ok) throw new Error("Failed to update payment details");
      
      setProfile({ ...profile, paymentId: paymentInput });
      setIsEditingPayment(false);
    } catch (err: any) {
      console.error(err);
    }
  };

  const renderStars = (rating: number, count: number) => {
    return (
      <div className="flex items-center gap-1">
        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="font-semibold text-sm">{rating > 0 ? rating.toFixed(1) : "New"}</span>
        <span className="text-xs text-zinc-400">({count})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent dark:border-white dark:border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col flex-1 items-center py-10 px-4 bg-zinc-50 dark:bg-black w-full">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: User Summary Card */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="flex flex-col p-6 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
            
            {/* Header / Avatar */}
            <div className="text-center mb-6">
              <div className="w-24 h-24 bg-linear-to-tr from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 rounded-full mx-auto flex items-center justify-center text-3xl font-bold mb-4 shadow-inner border border-gray-200 dark:border-gray-800 text-black dark:text-white">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">{profile.name}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{profile.email}</p>
              <p className="text-xs text-zinc-400 mt-2">
                Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
              </p>
            </div>

            <hr className="border-gray-100 dark:border-gray-800 mb-6" />

            {/* Ratings Grid */}
<div className="grid grid-cols-2 gap-4 mb-6">
  {/* Worker Link */}
  <Link 
    href={`/users/${profile.id}`}
    className="flex flex-col items-center p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all group"
  >
    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">Worker</span>
    <div className="group-hover:opacity-80 transition-opacity">
      {renderStars(profile.workerRating, profile.workerReviewCount)}
    </div>
  </Link>

  {/* Seeker Link */}
  <Link 
    href={`/users/${profile.id}`}
    className="flex flex-col items-center p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all group"
  >
    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">Seeker</span>
    <div className="group-hover:opacity-80 transition-opacity">
      {renderStars(profile.seekerRating, profile.seekerReviewCount)}
    </div>
  </Link>
</div>

            {/* Stats */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex justify-between items-center px-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Earnings</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-500">${profile.earnings.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Jobs Completed</span>
                <span className="text-md font-semibold text-black dark:text-white">{profile.completedJobs}</span>
              </div>
            </div>

            <hr className="border-gray-100 dark:border-gray-800 mb-6" />

            {/* Settings & Info */}
            <div className="flex flex-col gap-4 mb-6">
              
              {/* Location */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Home Base</span>
                  <button onClick={() => setIsEditingLocation(!isEditingLocation)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    {isEditingLocation ? "Cancel" : "Edit"}
                  </button>
                </div>
                {isEditingLocation ? (
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={addressInput} 
                      onChange={(e) => setAddressInput(e.target.value)} 
                      placeholder="Enter city or address"
                      className="w-full text-sm p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-black dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleGeocode} disabled={isGeocoding} className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-xs p-2 rounded-md font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700">
                        {isGeocoding ? "Finding..." : "Verify"}
                      </button>
                      <button onClick={handleGeolocation} className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-xs p-2 rounded-md font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700">
                        Use GPS
                      </button>
                    </div>
                    {locationError && <p className="text-red-500 text-xs">{locationError}</p>}
                    <button onClick={handleSaveLocation} className="w-full bg-black dark:bg-white text-white dark:text-black text-sm p-2 rounded-md font-bold mt-1">
                      Save Location
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">
                    {profile.address || "No location set"}
                  </p>
                )}
              </div>

              {/* Payout Routing */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Payout Routing (Stripe/PayPal)</span>
                  <button onClick={() => setIsEditingPayment(!isEditingPayment)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    {isEditingPayment ? "Cancel" : "Edit"}
                  </button>
                </div>
                {isEditingPayment ? (
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={paymentInput} 
                      onChange={(e) => setPaymentInput(e.target.value)} 
                      placeholder="Email or Routing ID"
                      className="w-full text-sm p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-black dark:text-white"
                    />
                    <button onClick={handleSavePayment} className="w-full bg-black dark:bg-white text-white dark:text-black text-sm p-2 rounded-md font-bold">
                      Save Payment Info
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate font-mono bg-zinc-100 dark:bg-zinc-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                    {profile.paymentId ? "••••" + profile.paymentId.slice(-4) : "Not configured"}
                  </p>
                )}
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="mt-auto w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-500 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Right Column: Archives */}
        <div className="md:col-span-2 flex flex-col gap-6">
          
          {/* Worker Archive */}
          <section className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 text-black dark:text-white">
              Work History
            </h2>
            {profile.workerComplete.length === 0 ? (
              <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                <p className="text-sm text-zinc-500">You haven't completed any jobs yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {profile.workerComplete.map(job => (
                  <div key={job.id} className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center transition-colors hover:border-gray-200 dark:hover:border-gray-700">
                    <div>
                      <h3 className="font-semibold text-md text-black dark:text-white">{job.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Completed on {new Date(job.completedAt).toLocaleDateString()} for{" "}
                        <Link 
                          href={`/users/${job.seeker?.id}`} 
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {job.seeker?.name}
                        </Link>
                      </p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">
                      + ${job.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seeker Archive */}
          <section className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 text-black dark:text-white">
              Jobs You Posted
            </h2>
            {profile.seekerComplete.length === 0 ? (
              <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                <p className="text-sm text-zinc-500">No jobs you posted have been completed yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {profile.seekerComplete.map(job => (
                  <div key={job.id} className="p-4 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-xl flex justify-between items-center opacity-80">
                    <div>
                      <h3 className="font-semibold text-md text-zinc-700 dark:text-zinc-300">{job.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Completed on {new Date(job.completedAt).toLocaleDateString()} for{" "}
                        <Link 
                          href={`/users/${job.worker?.id}`} 
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {job.worker?.name}
                        </Link>
                      </p>
                    </div>
                    <span className="bg-zinc-100 text-zinc-600 text-sm font-bold px-3 py-1 rounded-full dark:bg-zinc-800 dark:text-zinc-400">
                      - ${job.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}