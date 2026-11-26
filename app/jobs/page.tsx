import { redirect } from "next/navigation";

// The referral hub lives at /referrals. Old /jobs links land there.
export default function JobsPage() {
  redirect("/referrals");
}
