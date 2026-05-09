// web/src/app/reviews/new/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function ReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const jobId = searchParams.get("jobId");
  const targetId = searchParams.get("targetId");
  const role = searchParams.get("role"); // "seeker" or "worker"

  const initialJobTitle = searchParams.get("jobTitle") || "Job";
  const initialTargetName = searchParams.get("targetName") || "User";

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [targetName, setTargetName] = useState(initialTargetName);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        // If context wasn't passed in URL, fetch using the dynamic API_BASE
        if (!searchParams.get("jobTitle") || !searchParams.get("targetName")) {
          const userRes = await fetch(`${API_BASE}/api/users/${targetId}/public-profile`);
          const userData = await userRes.json();
          
          const jobRes = await fetch(`${API_BASE}/api/jobs/${jobId}`);
          const jobData = await jobRes.json();

          setTargetName(userData.name || "User");
          setJobTitle(jobData.title || "Job");
        }
      } catch (err) {
        console.error("Failed to fetch review context", err);
      } finally {
        setFetching(false);
      }
    };

    if (jobId && targetId) {
      fetchContext();
    } else {
      setFetching(false);
    }
  }, [jobId, targetId, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/auth");
      return;
    }
    const user = JSON.parse(storedUser);

    try {
      // POST review using the dynamic API_BASE
      const response = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          targetId,
          role,
          authorId: user.id,
          rating,
          comment,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit review");
      }

      router.push("/profile");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="text-center mt-20 text-zinc-500">Loading details...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Write a Review about <span className="text-blue-500">{jobTitle}</span>
        </h1>
        {/* DYNAMIC ROLE TEXT BELOW */}
        <p className="text-zinc-500">
          You are reviewing the <span className="font-semibold text-zinc-800 dark:text-zinc-200">{role === "seeker" ? "seeker" : "worker"}</span>, <span className="font-semibold text-zinc-800 dark:text-zinc-200">{targetName}</span>.
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300">
            How would you rate your experience?
          </label>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-4xl transition-all hover:scale-110 ${
                  rating >= star ? "text-yellow-500" : "text-zinc-200 dark:text-zinc-800"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">
            Comments (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full p-4 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-black text-black dark:text-white h-40 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder={`Tell us about your experience with ${targetName}...`}
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-900">
          <button 
            type="button" 
            onClick={() => router.back()} 
            className="flex-1 py-3 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading} 
            className="flex-1 py-3 rounded-xl font-bold bg-black dark:bg-white text-white dark:text-black disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? "Submitting..." : "Post Review"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="text-center p-10">Loading Review Form...</div>}>
      <ReviewForm />
    </Suspense>
  );
}