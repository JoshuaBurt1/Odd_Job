// web/src/app/users/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { name: string };
  job: { title: string };
};

type PublicProfile = {
  id: string;
  name: string;
  seekerRating: number;
  seekerReviewCount: number;
  workerRating: number;
  workerReviewCount: number;
  createdAt: string;
  completedJobs: number;
  workerComplete: any[];
  seekerComplete: any[];
  seekerReviews: Review[];
  workerReviews: Review[];
};

export default function PublicProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`http://localhost:4000/api/users/${id}/public-profile`)
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, [id]);

  if (loading) return (
    <div className="flex justify-center items-center h-64 text-zinc-500">
      <div className="animate-pulse flex items-center gap-2">
        <div className="w-4 h-4 bg-zinc-300 rounded-full"></div>
        <div className="w-4 h-4 bg-zinc-300 rounded-full"></div>
        <div className="w-4 h-4 bg-zinc-300 rounded-full"></div>
      </div>
    </div>
  );
  
  if (!profile) return <div className="p-8 text-center text-red-500 font-medium">User not found</div>;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-12 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-4xl font-bold shadow-inner">
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold mb-1">{profile.name}</h1>
          <p className="text-sm text-zinc-500 mb-4">Member since {new Date(profile.createdAt).getFullYear()}</p>
          <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
            <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm text-zinc-700 dark:text-zinc-300">
              {profile.completedJobs} Total Jobs Completed
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        
        {/* Seeker Profile (Put Above Worker) */}
        <section>
          <div className="flex items-center gap-4 mb-6 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-semibold">Seeker Profile</h2>
            <div className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm">
              ★ {profile.seekerRating.toFixed(1)} <span className="opacity-75 font-normal ml-1">({profile.seekerReviewCount} reviews)</span>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.seekerReviews && profile.seekerReviews.length > 0 ? (
              profile.seekerReviews.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))
            ) : (
              <div className="col-span-full p-8 text-center rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-zinc-500 italic">No reviews as a seeker yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Worker Profile */}
        <section>
          <div className="flex items-center gap-4 mb-6 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-semibold">Worker Profile</h2>
            <div className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm">
              ★ {profile.workerRating.toFixed(1)} <span className="opacity-75 font-normal ml-1">({profile.workerReviewCount} reviews)</span>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.workerReviews && profile.workerReviews.length > 0 ? (
              profile.workerReviews.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))
            ) : (
              <div className="col-span-full p-8 text-center rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-zinc-500 italic">No reviews as a worker yet.</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

// Reusable component for displaying individual reviews
function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="p-5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{review.author?.name || "Anonymous User"}</div>
          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1 truncate pr-4" title={review.job?.title}>
            Job: {review.job?.title || "Unknown Job"}
          </div>
        </div>
        <div className="flex items-center bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded text-amber-500 font-medium text-sm">
          ★ {review.rating.toFixed(1)}
        </div>
      </div>
      
      {review.comment && (
        <p className="text-sm mt-3 text-zinc-700 dark:text-zinc-300 italic">"{review.comment}"</p>
      )}
      
      <div className="text-xs text-zinc-400 mt-4 font-medium uppercase tracking-wider">
        {new Date(review.createdAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })}
      </div>
    </div>
  );
}