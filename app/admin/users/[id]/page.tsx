export const unstable_instant = false;

import { UserForm } from "@/components/admin/UserForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";
import { redirect, notFound } from "next/navigation";
import type { User } from "@/lib/types";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("*").eq("id", id).single();
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 animate-fadeIn space-y-6">
      <h1 className="text-2xl font-bold">Edit user</h1>
      <UserForm user={data as User} />
    </div>
  );
}
