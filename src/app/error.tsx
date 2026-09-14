"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { IconAlert, IconRefresh } from "@/components/icons";

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
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="panel pop w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger/12 text-danger">
          <IconAlert size="1.6rem" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{error.message || "An unexpected error occurred while loading."}</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-ink-3">ref {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" icon={<IconRefresh />} onClick={reset}>Try again</Button>
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>
      </div>
    </main>
  );
}
