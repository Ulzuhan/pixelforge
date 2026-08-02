"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Pixelforge error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted mb-6 text-center max-w-md">
        {error.message || "An unexpected error occurred while loading."}
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent/80 transition-all"
      >
        Try again
      </button>
    </div>
  );
}