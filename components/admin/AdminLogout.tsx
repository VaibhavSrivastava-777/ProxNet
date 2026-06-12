"use client";

import { useActionState } from "react";
import { logoutAdminAction } from "@/app/actions";

export function AdminLogout() {
  return (
    <form action={logoutAdminAction}>
      <button type="submit" className="btn btn-ghost btn-sm text-[var(--color-text-secondary)] hover:text-[var(--color-error)]">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
        </svg>
        Sign out
      </button>
    </form>
  );
}
