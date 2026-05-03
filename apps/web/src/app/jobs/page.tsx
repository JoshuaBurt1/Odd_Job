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
  seeker?: { name: string } | null;
  workerId?: string | null;
  worker?: { name: string } | null;
  createdAt: string;
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

  const fetchJobs = (currentUser: {id: string} | null = user) => {
    setLoading(true);
    const url = currentUser 
      ? `http://localhost:4000/api/jobs?userId=${currentUser.id}` 
      : "http://localhost:4000/api/jobs";

    fetch(url)
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
    const storedUser = localStorage.getItem("user");
    let currentUser = null;
    
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      setUser(currentUser);
    }
    fetchJobs(currentUser);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const eventSource = new EventSource('http://localhost:4000/api/jobs/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "REFRESH_JOBS") {
          fetchJobs(); 
        }
      } catch (err) {
        console.error("SSE Parse Error:", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
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
        body: JSON.stringify({ ...newJob, seekerId: user.id })
      });

      if (!response.ok) throw new Error("Failed to post job.");
      
      setNewJob({ title: "", type: "TRASH_CLEANUP", description: "", price: "" });
      setIsPosting(false);
      fetchJobs();
    } catch (error: any) {
      setPostError(error.message);
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    if (!user) return router.push("/auth");
    
    try {
      const response = await fetch(`http://localhost:4000/api/jobs/${jobId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: user.id })
      });
      if (!response.ok) throw new Error("Failed to accept job");
      fetchJobs();
    } catch (error) {
      console.error(error);
      alert("Could not accept job.");
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:4000/api/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: user?.id })
      });
      if (!response.ok) throw new Error("Failed to cancel job");
      fetchJobs();
    } catch (error) {
      console.error(error);
      alert("Could not cancel job.");
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:4000/api/jobs/${jobId}/complete`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to submit job");
      fetchJobs();
    } catch (error) {
      console.error(error);
      alert("Could not complete job.");
    }
  };

  const handleApproveJob = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:4000/api/jobs/${jobId}/approve`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to approve job");
      fetchJobs();
    } catch (error) {
      console.error(error);
      alert("Could not approve job.");
    }
  };

  const handleRejectJob = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:4000/api/jobs/${jobId}/reject`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to reject job");
      fetchJobs();
    } catch (error) {
      console.error(error);
      alert("Could not reject job.");
    }
  };

  const groupAndSortJobs = () => {
    const grouped: Record<string, Job[]> = {};
    
    jobs.forEach(job => {
      if (!grouped[job.type]) grouped[job.type] = [];
      grouped[job.type].push(job);
    });

    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        const getRank = (job: Job) => {
          if (user && job.seekerId === user.id && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(job.status)) return 1;
          if (user && job.seekerId === user.id && job.status === 'OPEN') return 2;
          if (user && job.workerId === user.id && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(job.status)) return 3;
          return 4;
        };

        const rankA = getRank(a);
        const rankB = getRank(b);

        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });

    return grouped;
  };

  const hasActiveJob = jobs.some(j => j.workerId === user?.id && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(j.status));
  const groupedJobs = groupAndSortJobs();

  // Helper to render appropriate actions/status based on job state and user role
  const renderJobActions = (job: Job) => {
    const isPoster = user?.id === job.seekerId;
    const isWorker = user?.id === job.workerId;

    if (job.status === 'COMPLETED') {
      return (
        <button disabled className="w-full py-2 text-sm rounded-md font-medium bg-gray-100 text-gray-500 dark:bg-gray-900/50 dark:text-gray-500 cursor-not-allowed">
          Completed
        </button>
      );
    }

    if (job.status === 'AWAITING_EVALUATION') {
      if (isPoster) {
        return (
          <div className="flex flex-col gap-2 w-full">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">
              Evaluate {job.worker?.name}'s work and release funds
            </span>
            <div className="flex gap-2">
              <button onClick={() => handleApproveJob(job.id)} className="flex-1 bg-green-600 text-white py-2 text-sm rounded-md font-medium hover:bg-green-700 transition-colors">
                Mark Completed
              </button>
              <button onClick={() => handleRejectJob(job.id)} className="px-3 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 py-2 text-sm rounded-md font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                Needs Improvement
              </button>
            </div>
          </div>
        );
      }
      if (isWorker) {
        return (
          <div className="flex flex-col gap-2 w-full">
            <button disabled className="w-full py-2 text-sm rounded-md font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700">
              Completed
            </button>
            <span className="text-xs text-center text-zinc-500 dark:text-zinc-400 font-medium">
              awaiting evaluation by poster ({job.seeker?.name})
            </span>
          </div>
        );
      }
    }

    if (job.status === 'ACCEPTED') {
      if (isPoster) {
        return (
          <button disabled className="w-full py-2 text-sm rounded-md font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700">
            Accepted by {job.worker?.name || 'Worker'}
          </button>
        );
      }
      if (isWorker) {
        return (
          <div className="flex gap-2 w-full">
            <button onClick={() => handleCompleteJob(job.id)} className="flex-1 bg-green-600 text-white py-2 text-sm rounded-md font-medium hover:bg-green-700 transition-colors">
              Complete
            </button>
            <button onClick={() => handleCancelJob(job.id)} className="px-3 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 py-2 text-sm rounded-md font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
              Cancel
            </button>
          </div>
        );
      }
    }

    // Status: OPEN
    if (isPoster) {
      return (
        <button disabled className="w-full py-2 text-sm rounded-md font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700">
          This is your posting
        </button>
      );
    }
    
    return (
      <button 
        onClick={() => handleAcceptJob(job.id)}
        disabled={hasActiveJob}
        className={`w-full py-2 text-sm rounded-md font-medium transition-opacity ${
          hasActiveJob 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-900 dark:text-gray-600'
            : 'bg-foreground text-background hover:opacity-90'
        }`}
      >
        {hasActiveJob ? 'Finish active job' : 'Accept Job'}
      </button>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Open Jobs</h1>
        {user ? (
          <button 
            onClick={() => setIsPosting(!isPosting)}
            className="bg-foreground text-background px-4 py-2 text-sm rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            {isPosting ? "Cancel Posting" : "+ Post a Job"}
          </button>
        ) : (
          <button 
            onClick={() => router.push("/auth")}
            className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm rounded-full font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Sign in to Post
          </button>
        )}
      </div>

      {isPosting && user && (
        <div className="mb-8 p-6 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#0a0a0a] shadow-sm">
          <h2 className="text-xl font-bold mb-4">Post a New Job</h2>
          {postError && <p className="text-red-500 mb-4 text-sm">{postError}</p>}
          <form onSubmit={handlePostJob} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-medium mb-1">Job Title</label>
              <input 
                type="text" required value={newJob.title}
                onChange={e => setNewJob({...newJob, title: e.target.value})}
                className="w-full p-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                placeholder="e.g. Clean up my front yard"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1">Job Category</label>
              <select 
                value={newJob.type}
                onChange={e => setNewJob({...newJob, type: e.target.value})}
                className="w-full p-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
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
              <label className="block text-xs font-medium mb-1">Bounty / Price ($)</label>
              <input 
                type="number" min="1" step="0.01" required value={newJob.price}
                onChange={e => setNewJob({...newJob, price: e.target.value})}
                className="w-full p-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                placeholder="50.00"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea 
                required rows={3} value={newJob.description}
                onChange={e => setNewJob({...newJob, description: e.target.value})}
                className="w-full p-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                placeholder="Describe what needs to be done, tools required, etc."
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <button type="submit" className="w-full bg-black dark:bg-white text-white dark:text-black py-2.5 text-sm rounded-md font-bold hover:opacity-90">
                Publish Job
              </button>
            </div>
          </form>
        </div>
      )}
      
      {loading ? (
        <p className="text-zinc-500 animate-pulse text-sm">Loading available jobs...</p>
      ) : Object.keys(groupedJobs).length === 0 ? (
        <div className="p-8 border border-dashed border-gray-300 dark:border-gray-800 rounded-lg text-center">
          <p className="text-zinc-500 text-sm">No open jobs available right now. Check back later!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(groupedJobs).map(([category, categoryJobs]) => (
            <div key={category} className="flex flex-col gap-4">
              <h3 className="text-lg font-bold border-b border-gray-200 dark:border-gray-800 pb-1.5 uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
                {category.replace(/_/g, ' ')}
              </h3>
              
              <div className="flex flex-col gap-3">
                {categoryJobs.map((job) => {
                  const isMyActiveJob = user?.id === job.workerId && ['ACCEPTED', 'AWAITING_EVALUATION'].includes(job.status);
                  
                  return (
                    <div key={job.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 flex flex-col md:flex-row gap-4 bg-white dark:bg-[#0a0a0a] shadow-sm hover:shadow-md transition-shadow">
                      
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-1 gap-4">
                          <h2 className="text-lg font-semibold leading-tight">{job.title}</h2>
                          <div className="flex flex-col items-end gap-1 shrink-0 md:hidden">
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full dark:bg-green-900/30 dark:text-green-400">
                              ${job.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                          Posted by <span className="font-medium text-zinc-700 dark:text-zinc-300">{job.seeker?.name || 'User'}</span> on {new Date(job.createdAt).toLocaleDateString()} at {new Date(job.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                        
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 flex-1 leading-relaxed whitespace-pre-wrap">
                          {job.description}
                        </p>
                      </div>

                      <div className="flex flex-col justify-between md:w-56 shrink-0 gap-3">
                        <div className="hidden md:flex flex-col items-end gap-1.5">
                          <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">
                            ${job.price.toFixed(2)}
                          </span>
                          {isMyActiveJob && job.status === 'ACCEPTED' && (
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-wider">
                              Work in Progress
                            </span>
                          )}
                          {job.status === 'AWAITING_EVALUATION' && (
                            <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded dark:bg-orange-900/30 dark:text-orange-400 uppercase tracking-wider">
                              In Review
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-auto flex justify-end">
                          {renderJobActions(job)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}