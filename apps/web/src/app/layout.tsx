import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Oddjob | Labor Marketplace",
  description: "Find local work or hire someone for odd jobs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Oddjob
          </Link>
          <div className="flex gap-6 font-medium text-sm">
            <Link href="/jobs" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Browse Jobs
            </Link>
            <Link href="/auth" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Login / Register
            </Link>
          </div>
        </nav>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}