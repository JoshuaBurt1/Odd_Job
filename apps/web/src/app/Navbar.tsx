"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";

export default function Navbar() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Standardize to localStorage and listen for updates
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

    // Close dropdown if clicked outside
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

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setDropdownOpen(false);
    window.dispatchEvent(new Event("storage")); 
    window.location.href = "/";
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
                  Profile
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