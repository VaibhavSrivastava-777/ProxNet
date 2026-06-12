import { auth, signOut } from "@/lib/auth";
import { NavClient } from "./NavClient";

export async function Nav() {
  const session = await auth();
  
  return (
    <NavClient
      session={!!session}
      userName={session?.user?.name || ""}
      userId={session?.user?.id || ""}
    />
  );
}
