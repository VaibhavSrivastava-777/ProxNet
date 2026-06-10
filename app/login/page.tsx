import Link from "next/link";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border bg-white p-8 dark:bg-zinc-900">
      <div>
        <h1 className="text-2xl font-bold">Welcome to ProxNet</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with LinkedIn to create your profile and discover professionals nearby.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("linkedin", { redirectTo: "/profile" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-lg bg-[#0A66C2] px-4 py-3 font-medium text-white hover:bg-[#004182]"
        >
          Continue with LinkedIn
        </button>
      </form>
      <p className="text-center text-xs text-zinc-500">
        <Link href="/admin/login" className="hover:underline">
          Admin login
        </Link>
      </p>
    </div>
  );
}
