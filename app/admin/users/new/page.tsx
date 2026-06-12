import { UserForm } from "@/components/admin/UserForm";

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 animate-fadeIn space-y-6">
      <h1 className="text-2xl font-bold">Add user</h1>
      <UserForm />
    </div>
  );
}
