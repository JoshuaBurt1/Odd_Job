// web/src/app/jobs/view/[id]/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import 'leaflet/dist/leaflet.css';

type Job = {
  id: string;
  title: string;
  type: string;
  description: string;
  price: number;
  status: string;
  startDate: string;
  expiryDate: string;
  createdAt: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
  seekerId: string;
  seeker?: { name: string } | null;
  workerId?: string | null;
  worker?: { name: string } | null;
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

export default function ViewJobPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const mapRef = useRef<HTMLDivElement>(null);
  
  const [job, setJob] = useState<Job | null>(null);
  const [user, setUser] = useState<{id: string, name: string} | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJob = () => {
    fetch(`http://localhost:4000/api/jobs/${id}`)
      .then(res => res.json())
      .then(data => {
        setJob(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (err) => console.error("Error getting location", err)
      );
    }
    fetchJob();
  }, [id]);

  useEffect(() => {
    if (typeof window !== "undefined" && !loading && job?.lat && job?.lng && mapRef.current) {
      // Inside the second useEffect, after importing (L)
      import("leaflet").then((L) => {
        if ((mapRef.current as any)._leaflet_id) return;

        const map = L.map(mapRef.current as HTMLElement).setView([job.lat!, job.lng!], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const blueIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        // Apply the icon to the Job Location marker
        L.marker([job.lat!, job.lng!], { icon: blueIcon })
          .addTo(map)
          .bindPopup('<b>Job Location</b>')
          .openPopup();

        if (userLocation) {
          const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', // Added shadow for consistency
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });
          L.marker([userLocation.lat, userLocation.lng], { icon: redIcon }).addTo(map).bindPopup('<b>Your Location</b>');
          
          const bounds = L.latLngBounds([[job.lat!, job.lng!], [userLocation.lat, userLocation.lng]]);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      });
    }
  }, [loading, job, userLocation]);

  const handleAcceptJob = async () => {
    if (!user) return router.push("/auth");
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: user.id, workerLat: userLocation?.lat, workerLng: userLocation?.lng })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to accept");
      fetchJob();
    } catch (err: any) { alert(err.message || "Could not accept job."); }
  };

  const handleCancelJob = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: user?.id })
      });
      if (!res.ok) throw new Error("Failed to cancel");
      fetchJob();
    } catch (err) { alert("Could not cancel job."); }
  };

  const handleCompleteJob = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to complete");
      fetchJob();
    } catch (err) { alert("Could not complete job."); }
  };

  const handleApproveJob = async () => {
    if (!window.confirm("Approve and release funds?")) return;
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve");
      alert("Job approved! Funds released.");
      router.push("/jobs");
    } catch (err) { alert("Could not approve job."); }
  };

  const handleRejectJob = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/jobs/${job?.id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reject");
      fetchJob();
    } catch (err) { alert("Could not reject job."); }
  };

  if (loading) return <div className="p-10 text-center">Loading job details...</div>;
  if (!job) return <div className="p-10 text-center">Job not found.</div>;

  const isPoster = user?.id === job.seekerId;
  const isWorker = user?.id === job.workerId;
  const isExpired = new Date(job.expiryDate) < new Date();
  const dist = (job.lat && job.lng && userLocation) ? calculateDistance(userLocation.lat, userLocation.lng, job.lat, job.lng) : null;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
      <button
        onClick={() => router.push("/jobs")}
        className="mb-6 text-sm text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-2 transition-colors"
      >
        ← Back to Jobs
      </button>

      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden p-6 md:p-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-3">{job.title}</h1>
            <div className="flex items-center gap-3">
              <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-semibold uppercase tracking-wider">
                {job.type.replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
                {job.status}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500 font-medium">
              {dist && <span className="text-blue-600 dark:text-blue-400">• {dist.toFixed(1)} km away</span>}
              {job.radius && <span>• Max Radius: {job.radius} km</span>}
            </div>
          </div>
          <div className="text-right">
            <span className="block text-4xl font-bold text-green-600 dark:text-green-400">
              ${job.price.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 border-t border-gray-100 dark:border-gray-900 pt-8">
          <div className="lg:col-span-5 space-y-8">
            <div>
              <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-widest mb-4">Description</h3>
              <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap italic">
                "{job.description}"
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm bg-gray-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500">Posted By</span>
                <span className="font-semibold">{job.seeker?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500">Location</span>
                <span className="font-semibold">{job.address || 'Location Hidden'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500">Posted Date</span>
                <span className="font-semibold">{new Date(job.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Expiry Date</span>
                <span className="font-semibold text-orange-600/80">{new Date(job.expiryDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 h-[500px] lg:h-[600px] bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden relative shadow-inner">
            {job.lat && job.lng ? (
              <div ref={mapRef} className="w-full h-full z-0" />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-gray-500">Location data unavailable</div>
            )}
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-end gap-4">
          {job.status === 'OPEN' && !isPoster && !isExpired && (
            <button onClick={handleAcceptJob} className="px-10 py-3 text-sm rounded-md font-bold bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-colors">
              Accept Job
            </button>
          )}
          {job.status === 'ACCEPTED' && isWorker && (
            <>
              <button onClick={handleCancelJob} className="px-6 py-3 text-sm rounded-md font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors">Cancel</button>
              <button onClick={handleCompleteJob} className="px-10 py-3 text-sm rounded-md font-bold bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:opacity-90">Mark Complete</button>
            </>
          )}
          {job.status === 'AWAITING_EVALUATION' && isPoster && (
            <>
              <button onClick={handleRejectJob} className="px-6 py-3 text-sm rounded-md font-bold bg-red-100 text-red-600 hover:bg-red-200">Needs Work</button>
              <button onClick={handleApproveJob} className="px-10 py-3 text-sm rounded-md font-bold bg-green-600 text-white hover:bg-green-700">Approve & Pay</button>
            </>
          )}
          {isPoster && job.status === 'OPEN' && (
            <button onClick={() => router.push(`/jobs/modify/${job.id}`)} className="px-10 py-3 text-sm rounded-md font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-700">
              Modify Posting
            </button>
          )}
        </div>
      </div>
    </div>
  );
}