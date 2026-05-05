// web/src/app/auth/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchGeocode } from "../../lib/geocoding";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLong, setUserLong] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGeocode = async () => {
    if (!address) return;
    const res = await fetchGeocode(address);
    if (res) {
      setUserLat(res.lat);
      setUserLong(res.lng);
      setAddress(res.formatted); 
      setErrorMsg("");
    } else {
      setErrorMsg("Could not find coordinates for this address.");
    }
  };

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLong(pos.coords.longitude);
          setAddress("Location set via Device GPS");
          setErrorMsg("");
        },
        () => setErrorMsg("Geolocation failed or was denied.")
      );
    } else {
      setErrorMsg("Geolocation is not supported by your browser.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isLogin && (!userLat || !userLong)) {
      setErrorMsg("Please provide and verify your location before registering.");
      return;
    }

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin 
      ? { email, password } 
      : { name, email, password, address, userLat, userLong };

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
      
      // 1. Save the standard user object
      localStorage.setItem("user", JSON.stringify(user));

      const finalLat = userLat || user.userLat || user.lat;
      const finalLng = userLong || user.userLong || user.lng;
      const finalAddress = address || user.address || "Saved Location";

      if (finalLat && finalLng) {
        localStorage.setItem("lastLocation", JSON.stringify({
          lat: finalLat,
          lng: finalLng,
          name: finalAddress
        }));
      }
      
      window.dispatchEvent(new Event("storage"));
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

          {!isLogin && (
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900">
              <label className="block text-sm font-medium mb-1.5">Set Your Location</label>
              <div className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm" 
                  placeholder="Enter address..." 
                />
                <button 
                  type="button" 
                  onClick={handleGeocode}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-sm font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"
                >
                  Verify
                </button>
              </div>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-gray-500">OR</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <button 
                type="button" 
                onClick={handleGeolocation}
                className="w-full py-2.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-sm font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                📍 Use My GPS Location
              </button>
              {userLat && userLong && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-3 text-center">
                  Location verified: {userLat.toFixed(4)}, {userLong.toFixed(4)}
                </p>
              )}
            </div>
          )}
          
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