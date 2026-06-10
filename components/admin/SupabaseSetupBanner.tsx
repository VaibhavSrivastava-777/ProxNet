import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export function SupabaseSetupBanner() {
  if (isSupabaseConfigured()) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-medium">Supabase is not configured</p>
      <p className="mt-1">
        Add your Supabase URL and keys to <code>.env.local</code>, run the SQL migration in{" "}
        <code>supabase/migrations/001_initial_schema.sql</code>, then{" "}
        <code>npm run seed:admin</code> to enable user management.
      </p>
    </div>
  );
}
