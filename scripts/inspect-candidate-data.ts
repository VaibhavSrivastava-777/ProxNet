import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function inspect() {
  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .ilike("full_name", "%vaibhav%");

  if (error || !users || users.length === 0) {
    console.error("User not found or error:", error);
    return;
  }

  const user = users[0];
  const { data: networkUsers } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, email, society_name:profile_digest->>society_name")
    .eq("is_active", true)
    .neq("id", user.id);

  console.log("Total active network users:", networkUsers?.length || 0);

  // Users at HP or hardware/enterprise tech
  const targetMatches = (networkUsers || []).filter(u => {
    const c = (u.company || "").toLowerCase();
    return c.includes("hp") || c.includes("hewlett") || c.includes("lenovo") || c.includes("cisco") || c.includes("microsoft") || c.includes("google") || c.includes("oracle") || c.includes("apple");
  });
  console.log("Target company network users:", targetMatches);

  // Users from IIM Lucknow
  const iimUsers = (networkUsers || []).filter(u => {
    const email = (u.email || "").toLowerCase();
    return email.includes("iiml");
  });
  console.log("IIM Lucknow alumni users:", iimUsers);

  const { data: rows, error: rowErr } = await supabase
    .from("scraped_jobs")
    .select("*")
    .limit(5);

  // Test HP career URL
  try {
    const hpWorkday = "https://hp.wd5.myworkdayjobs.com/ExternalCareerSite";
    const detailUrl = "https://hp.wd5.myworkdayjobs.com/wday/cxs/hp/ExternalCareerSite/job/Bengaluru-Karnataka-India/Artificial-Intelligence-Business-Architect_3166630-2";
    console.log("Fetching detail for HP AI Business Architect...");
    const resDetail = await fetch(detailUrl, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log("Detail status:", resDetail.status);
    if (resDetail.ok) {
      const dataDetail = await resDetail.json();
      console.log("Job Title:", dataDetail.jobPostingInfo?.title);
      console.log("Job Req ID:", dataDetail.jobPostingInfo?.jobReqId);
      console.log("Location:", dataDetail.jobPostingInfo?.location);
      console.log("Job Description length:", dataDetail.jobPostingInfo?.jobDescription?.length);
      console.log("Job Description preview:\n", (dataDetail.jobPostingInfo?.jobDescription || "").slice(0, 500));
    }
  } catch (err: any) {
    console.log("HP Workday fetch error:", err.message);
  }
}

inspect().catch(console.error);
