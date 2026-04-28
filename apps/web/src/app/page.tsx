import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 text-center bg-zinc-50 dark:bg-black">
      <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-black dark:text-zinc-50">
        Welcome to Oddjob
      </h1>
      <p className="text-lg md:text-xl mb-10 max-w-2xl text-zinc-600 dark:text-zinc-400">
        The best place to find local workers for your home projects, or pick up some extra cash helping your neighbors.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/jobs"
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 font-medium text-background transition-colors hover:opacity-90"
        >
          View Open Jobs
        </Link>
        <Link
          href="/auth"
          className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.08] px-8 font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}