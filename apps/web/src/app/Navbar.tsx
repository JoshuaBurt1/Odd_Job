// web/src/app/Navbar.tsx
"use client";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// 1. Define API base once at the top
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [activeJob, setActiveJob] = useState<{ id: string; title: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkSession = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }
    };

    checkSession();
    window.addEventListener("storage", checkSession);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("storage", checkSession);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchActiveJob = useCallback(() => {
    if (user) {
      // 2. Updated to use API_BASE
      fetch(`${API_BASE}/api/users/${user.id}/active-job`)
        .then(res => res.json())
        .then(data => setActiveJob(data.activeJob || null))
        .catch(console.error);
    } else {
      setActiveJob(null);
    }
  }, [user]);

  // Handle Fetching and Event Listeners
  useEffect(() => {
    fetchActiveJob();

    // Listen for local state changes
    window.addEventListener("job-status-changed", fetchActiveJob);

    // 3. Updated SSE URL to use API_BASE
    const eventSource = new EventSource(`${API_BASE}/api/jobs/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "REFRESH_JOBS") {
          fetchActiveJob();
        }
      } catch (error) {
        console.error("SSE Error in Navbar:", error);
      }
    };

    return () => {
      window.removeEventListener("job-status-changed", fetchActiveJob);
      eventSource.close();
    };
  }, [fetchActiveJob]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setDropdownOpen(false);
    window.dispatchEvent(new Event("storage")); 
    // 4. Using router.push instead of window.location.href for a smoother transition
    router.push("/");
  };

  return (
    <nav className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800 relative z-50">
      <Link href="/" className="text-2xl font-bold tracking-tight">
        Odd Job
      </Link>
      <div className="flex gap-6 items-center font-medium text-sm">
        <Link href="/jobs" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Browse Jobs
        </Link>
        
        {activeJob && (
          <Link href={`/jobs/view/${activeJob.id}`} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline transition-colors">
            Current Job: {activeJob.title}
          </Link>
        )}
        
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
              className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
            >
              {user.name}
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
                <Link 
                  href="/profile" 
                  onClick={() => setDropdownOpen(false)}
                  className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-b border-gray-100 dark:border-gray-800 text-zinc-800 dark:text-zinc-200"
                >
                  Account Settings
                </Link>

                <Link 
                  href={`/public-profile?id=${user.id}`} 
                  onClick={() => setDropdownOpen(false)}
                  className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-b border-gray-100 dark:border-gray-800 text-zinc-800 dark:text-zinc-200"
                >
                  Reviews
                </Link>

                <button 
                  onClick={handleLogout} 
                  className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/auth" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Login / Register
          </Link>
        )}
      </div>
    </nav>
  );
}