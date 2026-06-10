"use client";

import { useRouter } from "next/navigation";

export function AdminLogout() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="text-sm text-zinc-500 hover:text-red-600"
    >
      Sign out
    </button>
  );
}
