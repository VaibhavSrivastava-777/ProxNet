import { UserForm } from "@/components/admin/UserForm";

export default function NewUserPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add user</h1>
      <UserForm />
    </div>
  );
}
