"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Job = {
  id: string;
  title: string;
  type: string;
  description: string;
  price: number;
  status: string;
  seekerId: string;
};

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{id: string, name: string} | null>(null);
  
  // Job Posting State
  const [isPosting, setIsPosting] = useState(searchParams.get("action") === "post");
  const [newJob, setNewJob] = useState({ title: "", type: "TRASH_CLEANUP", description: "", price: "" });
  const [postError, setPostError] = useState("");

  const fetchJobs = () => {
    setLoading(true);
    fetch("http://localhost:4000/api/jobs/open")
      .then((res) => res.json())
      .then((data) => {
        setJobs(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch jobs", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // Check auth status
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchJobs();
  }, []);

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError("");

    if (!user) {
      router.push("/auth");
      return;
    }

    try {
      const response = await fetch("http://localhost:4000/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newJob,
          seekerId: user.id
        })
      });

      if (!response.ok) throw new Error("Failed to post job.");
      
      // Reset form and refresh list
      setNewJob({ title: "", type: "TRASH_CLEANUP", description: "", price: "" });
      setIsPosting(false);
      fetchJobs();
    } catch (error: any) {
      setPostError(error.message);
    }
  };

  return (
    <div className="p-8 md:p-16 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Open Jobs</h1>
        {user ? (
          <button 
            onClick={() => setIsPosting(!isPosting)}
            className="bg-foreground text-background px-6 py-2.5 rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            {isPosting ? "Cancel Posting" : "+ Post a Job"}
          </button>
        ) : (
          <button 
            onClick={() => router.push("/auth")}
            className="border border-gray-300 dark:border-gray-700 px-6 py-2.5 rounded-full font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Sign in to Post
          </button>
        )}
      </div>

      {/* Job Posting Form */}
      {isPosting && user && (
        <div className="mb-12 p-8 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-[#0a0a0a] shadow-sm">
          <h2 className="text-2xl font-bold mb-6">Post a New Job</h2>
          {postError && <p className="text-red-500 mb-4 text-sm">{postError}</p>}
          <form onSubmit={handlePostJob} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Job Title</label>
              <input 
                type="text" required
                value={newJob.title}
                onChange={e => setNewJob({...newJob, title: e.target.value})}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                placeholder="e.g. Clean up my front yard"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Job Category</label>
              <select 
                value={newJob.type}
                onChange={e => setNewJob({...newJob, type: e.target.value})}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
              >
                <option value="TRASH_CLEANUP">Trash Cleanup</option>
                <option value="HOME_GARDEN_CLEANUP">Home & Garden Cleanup</option>
                <option value="GRASS_CUTTING">Grass Cutting</option>
                <option value="DECK_FENCE_BUILDING">Deck & Fence Building</option>
                <option value="GARDEN_TENDING">Garden Tending</option>
                <option value="CROP_PICKING">Crop Picking</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Bounty / Price ($)</label>
              <input 
                type="number" min="1" step="0.01" required
                value={newJob.price}
                onChange={e => setNewJob({...newJob, price: e.target.value})}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                placeholder="50.00"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea 
                required rows={4}
                value={newJob.description}
                onChange={e => setNewJob({...newJob, description: e.target.value})}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent"
                placeholder="Describe what needs to be done, tools required, etc."
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <button type="submit" className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-lg font-bold hover:opacity-90">
                Publish Job
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Job Listings */}
      {loading ? (
        <p className="text-zinc-500 animate-pulse">Loading available jobs...</p>
      ) : jobs.length === 0 ? (
        <div className="p-12 border border-dashed border-gray-300 dark:border-gray-800 rounded-xl text-center">
          <p className="text-zinc-500">No open jobs available right now. Check back later!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobs.map((job) => (
            <div key={job.id} className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col bg-white dark:bg-[#0a0a0a] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-2xl font-semibold leading-tight">{job.title}</h2>
                <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">
                  ${job.price.toFixed(2)}
                </span>
              </div>
              
              <span className="inline-block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider bg-gray-100 dark:bg-gray-800/50 self-start px-2 py-1 rounded">
                {job.type.replace(/_/g, ' ')}
              </span>
              
              <p className="text-zinc-600 dark:text-zinc-400 mb-8 flex-1 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
              
              <button 
                onClick={() => user ? alert('Accept flow coming soon!') : router.push('/auth')}
                className={`w-full py-3 rounded-lg font-medium transition-opacity ${
                  user?.id === job.seekerId 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-900 dark:text-gray-600'
                    : 'bg-foreground text-background hover:opacity-90'
                }`}
                disabled={user?.id === job.seekerId}
              >
                {user?.id === job.seekerId ? 'This is your posting' : 'Accept Job'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}