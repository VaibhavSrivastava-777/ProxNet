import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

const links = [
  { href: "/profile", label: "Profile" },
  { href: "/proximity", label: "Proximity" },
  { href: "/qa", label: "Q&A" },
];

export async function Nav() {
  const session = await auth();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-blue-700">
          ProxNet
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {session ? (
            <>
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-blue-600">
                  {l.label}
                </Link>
              ))}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit" className="text-zinc-500 hover:text-red-600">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-blue-600 hover:underline">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
