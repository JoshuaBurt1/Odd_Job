"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ArchiveJob = {
  id: string;
  title: string;
  price: number;
  completedAt: string;
  worker?: { name: string };
  seeker?: { name: string };
};

type UserProfile = {
  name: string;
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

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    
    if (!storedUser) {
      router.push("/auth");
      return;
    }

    const user = JSON.parse(storedUser);

    // Dispatching a storage event fixes the issue where the Navbar fails to update 
    // without a reload after the user login/registration cycle completes.
    window.dispatchEvent(new Event("storage"));

    fetch(`http://localhost:4000/api/users/${user.id}/profile`)
      .then((res) => {
        if (!res.ok) {
          // If a 404 is thrown due to an empty or newly created DB record, gracefully
          // return an empty profile shell using the known user data from localStorage.
          return {
            name: user.name,
            createdAt: new Date().toISOString(),
            completedJobs: 0,
            earnings: 0,
            workerComplete: [],
            seekerComplete: []
          };
        }
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch profile", err);
        // Secondary fallback to ensure the UI still renders during network errors
        setProfile({
          name: user.name || "User",
          createdAt: new Date().toISOString(),
          completedJobs: 0,
          earnings: 0,
          workerComplete: [],
          seekerComplete: []
        });
        setLoading(false);
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage")); // Ensure navbar drops the name immediately
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
    <div className="flex flex-col flex-1 items-center py-10 px-4 bg-zinc-50 dark:bg-black w-full">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: User Summary Card */}
        <div className="md:col-span-1 h-fit p-8 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full mx-auto flex items-center justify-center text-2xl font-bold mb-4 border border-gray-200 dark:border-gray-800">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-3xl font-bold mb-1 tracking-tight">{profile.name}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Oddjobber since {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'})}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-8">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Jobs Completed</p>
              <p className="text-xl font-bold text-black dark:text-white">{profile.completedJobs}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20 flex justify-between items-center">
              <p className="text-xs text-green-600 dark:text-green-500 uppercase tracking-wider font-semibold">Earnings</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">
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

        {/* Right Column: Archives */}
        <div className="md:col-span-2 flex flex-col gap-8">
          
          {/* Worker Archive */}
          <section>
            <h2 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-4 text-zinc-800 dark:text-zinc-200">
              Your Completed Work
            </h2>
            {profile.workerComplete.length === 0 ? (
              <p className="text-sm text-zinc-500 italic p-4 bg-white dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-gray-800">
                You haven't completed any jobs yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {profile.workerComplete.map(job => (
                  <div key={job.id} className="p-4 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-lg flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-md">{job.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Completed on {new Date(job.completedAt).toLocaleDateString()} for {job.seeker?.name}
                      </p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">
                      + ${job.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seeker Archive */}
          <section>
            <h2 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-2 mb-4 text-zinc-800 dark:text-zinc-200">
              Jobs You Posted (Completed)
            </h2>
            {profile.seekerComplete.length === 0 ? (
              <p className="text-sm text-zinc-500 italic p-4 bg-white dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-gray-800">
                No jobs you posted have been completed yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {profile.seekerComplete.map(job => (
                  <div key={job.id} className="p-4 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-lg flex justify-between items-center opacity-80">
                    <div>
                      <h3 className="font-semibold text-md text-zinc-700 dark:text-zinc-300">{job.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Completed on {new Date(job.completedAt).toLocaleDateString()} by {job.worker?.name}
                      </p>
                    </div>
                    <span className="bg-zinc-100 text-zinc-600 text-xs font-bold px-2.5 py-1 rounded-full dark:bg-zinc-800 dark:text-zinc-400">
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