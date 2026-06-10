import Link from "next/link";
import { UserTable } from "@/components/admin/UserTable";
import { AdminLogout } from "@/components/admin/AdminLogout";
import { SupabaseSetupBanner } from "@/components/admin/SupabaseSetupBanner";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
          <p className="text-sm text-zinc-600">Manage ProxNet users</p>
        </div>
        <AdminLogout />
      </div>
      <SupabaseSetupBanner />
      <UserTable />
      <p className="text-xs text-zinc-500">
        <Link href="/" className="hover:underline">
          Back to site
        </Link>
      </p>
    </div>
  );
}
