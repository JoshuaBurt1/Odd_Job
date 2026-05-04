"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PostJobPage() {
  const router = useRouter();
  const [user, setUser] = useState<{id: string, name: string} | null>(null);
  const [newJob, setNewJob] = useState({ title: "", type: "TRASH_CLEANUP", description: "", price: "" });
  const [postError, setPostError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user"); 
    if (!storedUser) {
        router.push("/auth"); 
    } else {
        setUser(JSON.parse(storedUser));
    }
    }, [router]);

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError("");
    if (!user) return;

    try {
      const response = await fetch("http://localhost:4000/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newJob, price: parseFloat(newJob.price), seekerId: user.id })
      });

      if (!response.ok) throw new Error("Failed to post job.");
      router.push("/jobs"); // Return to jobs list after success
    } catch (error: any) {
      setPostError(error.message);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto w-full">
      <button 
        onClick={() => router.push("/jobs")}
        className="mb-6 text-sm text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-2 transition-colors"
      >
        ← Back to Jobs
      </button>

      <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#0a0a0a] shadow-sm">
        <h2 className="text-2xl font-bold mb-6">Post a New Job</h2>
        {postError && <p className="text-red-500 mb-4 text-sm">{postError}</p>}
        
        <form onSubmit={handlePostJob} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">Job Title</label>
            <input 
              type="text" required value={newJob.title}
              onChange={e => setNewJob({...newJob, title: e.target.value})}
              className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent focus:ring-1 focus:ring-black outline-none"
              placeholder="e.g. Clean up my front yard"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">Category</label>
              <select 
                value={newJob.type}
                onChange={e => setNewJob({...newJob, type: e.target.value})}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none"
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
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">Bounty ($)</label>
              <input 
                type="number" min="1" step="0.01" required value={newJob.price}
                onChange={e => setNewJob({...newJob, price: e.target.value})}
                className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none"
                placeholder="50.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider text-zinc-500">Description</label>
            <textarea 
              required rows={5} value={newJob.description}
              onChange={e => setNewJob({...newJob, description: e.target.value})}
              className="w-full p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-transparent outline-none resize-none"
              placeholder="Describe tools required, timeframe, etc."
            />
          </div>

          <button type="submit" className="w-full bg-black dark:bg-white text-white dark:text-black py-3 text-sm rounded-md font-bold hover:opacity-90 transition-opacity mt-2">
            Publish Job Listing
          </button>
        </form>
      </div>
    </div>
  );
}