"use client";
import { useEffect, useState } from "react";

// Matches the data structure from your Prisma schema
type Job = {
  id: string;
  title: string;
  type: string;
  description: string;
  price: number;
  status: string;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetching from your Express backend running on port 4000
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
  }, []);

  return (
    <div className="p-8 md:p-16 max-w-6xl mx-auto w-full">
      <h1 className="text-4xl font-bold mb-10 tracking-tight">Open Jobs</h1>
      
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
              
              <p className="text-zinc-600 dark:text-zinc-400 mb-8 flex-1 leading-relaxed">
                {job.description}
              </p>
              
              <button className="w-full bg-foreground text-background py-3 rounded-lg font-medium hover:opacity-90 transition-opacity">
                Accept Job
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}