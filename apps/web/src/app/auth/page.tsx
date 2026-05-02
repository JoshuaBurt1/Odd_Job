"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin 
      ? { email, password } 
      : { name, email, password };

    try {
      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Authentication failed.");
      }

      const user = await response.json();
      
      // Store user info in localStorage for future API calls
      localStorage.setItem("user", JSON.stringify(user));
      
      alert(`Successfully ${isLogin ? 'logged in' : 'registered'}! Redirecting to jobs portal...`);
      router.push('/jobs');
      
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4 bg-zinc-50 dark:bg-black min-h-screen">
      <div className="w-full max-w-md border border-gray-200 dark:border-gray-800 rounded-2xl p-8 bg-white dark:bg-[#0a0a0a] shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        
        {/* Toggle Login/Register */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-lg inline-flex w-full">
            <button
              onClick={() => { setIsLogin(true); setErrorMsg(""); }}
              type="button"
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                isLogin 
                  ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setErrorMsg(""); }}
              type="button"
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

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {errorMsg && (
            <div className="p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground/20" 
                placeholder="John Doe" 
                required={!isLogin} 
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground/20" 
              placeholder="you@example.com" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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