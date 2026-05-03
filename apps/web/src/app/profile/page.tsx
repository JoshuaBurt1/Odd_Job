"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserProfile = {
  name: string;
  createdAt: string;
  completedJobs: number;
  earnings: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    
    if (!storedUser) {
      router.push("/auth");
      return;
    }

    const user = JSON.parse(storedUser);

    fetch(`http://localhost:4000/api/users/${user.id}/profile`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch profile", err);
        setLoading(false);
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    // Hard redirect to clear the client-side navbar state
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <p className="text-zinc-500 animate-pulse">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <p className="text-red-500">Failed to load profile. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md p-8 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full mx-auto flex items-center justify-center text-2xl font-bold mb-4 border border-gray-200 dark:border-gray-800">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-3xl font-bold mb-1 tracking-tight">{profile.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Oddjobber since {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'})}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider font-semibold">Jobs Completed</p>
            <p className="text-3xl font-bold text-black dark:text-white">{profile.completedJobs}</p>
          </div>
          <div className="p-5 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20 text-center">
            <p className="text-xs text-green-600 dark:text-green-500 mb-1 uppercase tracking-wider font-semibold">Total Earnings</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              ${profile.earnings.toFixed(2)}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-500 dark:hover:bg-red-900/40 rounded-xl transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}