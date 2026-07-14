import { auth } from "@/lib/auth";
import { NavClient } from "./NavClient";
import { Suspense } from "react";

export function Nav() {
  return (
    <Suspense fallback={<NavFallback />}>
      <NavInner />
    </Suspense>
  );
}

function NavFallback() {
  return (
    <header className="fixed top-0 left-0 right-0 bg-[var(--color-surface)] border-b border-[var(--color-border-light)] z-[1000] flex items-center justify-between px-4" style={{ height: "var(--nav-height)" }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-[var(--color-border-light)] animate-pulse" />
        <div className="h-4 w-24 bg-[var(--color-border-light)] rounded animate-pulse" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--color-border-light)] animate-pulse" />
      </div>
    </header>
  );
}

async function NavInner() {
  const session = await auth();
  
  return (
    <NavClient
      session={!!session}
      userName={session?.user?.name || ""}
      userId={session?.user?.id || ""}
    />
  );
}
