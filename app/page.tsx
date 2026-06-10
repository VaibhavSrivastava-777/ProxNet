import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-8 py-12 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">ProxNet</h1>
        <p className="mt-3 max-w-2xl text-blue-100">
          Connect with anonymized professionals in your society. Discover who works nearby,
          ask questions, and chat privately — without revealing identities.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {session ? (
            <>
              <Link
                href="/proximity"
                className="rounded-lg bg-white px-5 py-2.5 font-medium text-blue-700 hover:bg-blue-50"
              >
                Explore proximity
              </Link>
              <Link
                href="/profile"
                className="rounded-lg border border-white/40 px-5 py-2.5 hover:bg-white/10"
              >
                My profile
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-white px-5 py-2.5 font-medium text-blue-700 hover:bg-blue-50"
            >
              Login with LinkedIn
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Proximity map",
            desc: "See company clusters within your chosen radius on an interactive map.",
          },
          {
            title: "Anonymous Q&A",
            desc: "Post questions delivered only to relevant nearby professionals.",
          },
          {
            title: "Private chat",
            desc: "Chat anonymously when a professional responds to your question.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border bg-white p-5 dark:bg-zinc-900">
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
