"use client";
import { useState } from "react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<"SEEKER" | "WORKER">("SEEKER");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Authentication logic will hook up to the backend here
    console.log("Form Submitted", { isLogin, role });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4 bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md border border-gray-200 dark:border-gray-800 rounded-2xl p-8 bg-white dark:bg-[#0a0a0a] shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        
        {/* Toggle Login/Register */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-lg inline-flex w-full">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                isLogin 
                  ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                !isLogin 
                  ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Role Selection (Only visible during Registration) */}
        {!isLogin && (
          <div className="mb-8">
            <label className="block text-sm font-semibold mb-3">I want to...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole("SEEKER")}
                className={`p-3 border rounded-xl text-sm font-medium transition-all ${
                  role === "SEEKER" 
                    ? 'border-foreground bg-gray-50 dark:bg-gray-800/50 shadow-inner' 
                    : 'border-gray-200 dark:border-gray-800 text-gray-500'
                }`}
              >
                Post Jobs
              </button>
              <button
                onClick={() => setRole("WORKER")}
                className={`p-3 border rounded-xl text-sm font-medium transition-all ${
                  role === "WORKER" 
                    ? 'border-foreground bg-gray-50 dark:bg-gray-800/50 shadow-inner' 
                    : 'border-gray-200 dark:border-gray-800 text-gray-500'
                }`}
              >
                Find Work
              </button>
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input 
                type="text" 
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground/20" 
                placeholder="John Doe" 
                required 
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address</label>
            <input 
              type="email" 
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground/20" 
              placeholder="you@example.com" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input 
              type="password" 
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground/20" 
              placeholder="••••••••" 
              required 
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full mt-2 bg-foreground text-background py-3.5 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            {isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}