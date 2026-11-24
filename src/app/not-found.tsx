import Link from "next/link";
import { IconAlert } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="panel pop w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/12 text-accent">
          <IconAlert size="1.6rem" />
        </span>
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-ink-3">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Nothing at this address</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          The page you asked for is not here, or the link has changed.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
