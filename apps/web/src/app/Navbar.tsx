"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // Check local storage for existing session
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <nav className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800">
      <Link href="/" className="text-2xl font-bold tracking-tight">
        Oddjob
      </Link>
      <div className="flex gap-6 items-center font-medium text-sm">
        <Link href="/jobs" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Browse Jobs
        </Link>
        
        {user ? (
          <Link href="/profile" className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            {user.name}
          </Link>
        ) : (
          <Link href="/auth" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Login / Register
          </Link>
        )}
      </div>
    </nav>
  );
}