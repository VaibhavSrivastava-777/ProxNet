import Link from "next/link";
import { UserTable } from "@/components/admin/UserTable";
import { AdminLogout } from "@/components/admin/AdminLogout";
import { SupabaseSetupBanner } from "@/components/admin/SupabaseSetupBanner";
import { AdminJobForm } from "@/components/admin/AdminJobForm";
import { AdminCarpoolForm } from "@/components/admin/AdminCarpoolForm";
import { AdminCarpoolTable } from "@/components/admin/AdminCarpoolTable";

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 animate-fadeIn" style={{ minHeight: "100vh" }}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-h1 m-0">Admin Dashboard</h1>
          <span className="badge badge-accent shadow-sm" style={{ padding: "4px 10px" }}>Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="btn btn-ghost btn-sm">
            Back to site
          </Link>
          <AdminLogout />
        </div>
      </div>
      
      <div className="mb-6">
        <SupabaseSetupBanner />
      </div>
      
      <UserTable />

      <AdminJobForm />

      <AdminCarpoolForm />

      <AdminCarpoolTable />
    </div>
  );
}
