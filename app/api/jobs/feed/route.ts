import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const radius = parseFloat(searchParams.get("radius") || "1000");
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");

  const supabase = createAdminClient();

  // 1. Get companies with active unblocked users
  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("company")
    .eq("is_blocked", false)
    .not("company", "is", null);

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });

  const activeCompanies = Array.from(new Set(usersData.map((u: any) => u.company.trim().toLowerCase())));

  // 2. Fetch scraped jobs for these companies
  const { data: scrapedJobs, error: scrapedError } = await supabase
    .from("scraped_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (scrapedError) return NextResponse.json({ error: scrapedError.message }, { status: 500 });

  const filteredScrapedJobs = (scrapedJobs || []).filter((job: any) => {
    return job.company_name && activeCompanies.includes(job.company_name.trim().toLowerCase());
  });

  // Map to JobFeed compatible format
  const formattedPosts = filteredScrapedJobs.map((job: any) => ({
    id: job.id,
    type: "giver", // Treat scraped jobs as "givers" (the company is offering the job)
    role: job.title || job.role || "Job Opening",
    company: job.company_name,
    experience_years: 0,
    skills: job.keywords || job.location || "",
    created_at: job.created_at || job.posted_at || new Date().toISOString(),
    is_scraped: true,
    url: job.url,
    description: job.description || "",
    user: {
      full_name: `${job.company_name} ATS`,
      company: job.company_name,
      job_title: "Automated Hiring"
    }
  }));

  // Fetch myPosts to allow user to see their own posts still (if needed)
  const { data: activePosts } = await supabase
    .from("job_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return NextResponse.json({ 
    posts: formattedPosts, 
    myPosts: activePosts || [],
    othersCount: formattedPosts.length,
    requiresPost: false,
    currentUserId: user.id
  });
}
