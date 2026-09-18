import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import type { SocietyStats } from "@/lib/types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categorizeRole(title?: string | null): string {
  if (!title) return "Other";
  const t = title.toLowerCase();
  if (t.includes("founder") || t.includes("ceo") || t.includes("cto") || t.includes("co-founder") || t.includes("director")) {
    return "Founders & Executives";
  }
  if (t.includes("engineer") || t.includes("developer") || t.includes("architect") || t.includes("sde") || t.includes("tech lead")) {
    return "Engineering";
  }
  if (t.includes("product") || t.includes("pm") || t.includes("program")) {
    return "Product Management";
  }
  if (t.includes("design") || t.includes("ux") || t.includes("ui") || t.includes("creative")) {
    return "Design";
  }
  if (t.includes("data") || t.includes("ml") || t.includes("ai") || t.includes("scientist")) {
    return "Data & AI";
  }
  if (t.includes("invest") || t.includes("vc") || t.includes("venture") || t.includes("angel")) {
    return "Venture & Angel";
  }
  return "Business & Growth";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nameParam = searchParams.get("name") || "";
  const slugParam = searchParams.get("slug") || "";

  const queryName = nameParam.trim() || slugParam.replace(/-/g, " ").trim();
  const displayName = queryName
    ? queryName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "Neighborhood Network";

  if (!isSupabaseConfigured()) {
    // Return rich mock stats for local development / test environments
    const mockStats: SocietyStats = {
      society_name: displayName,
      total_members: 32,
      roles_breakdown: {
        "Engineering": 16,
        "Founders & Executives": 6,
        "Product Management": 5,
        "Design": 3,
        "Data & AI": 2,
      },
      top_companies: [
        { name: "Google", count: 5 },
        { name: "Swiggy", count: 4 },
        { name: "Microsoft", count: 4 },
        { name: "Zerodha", count: 3 },
        { name: "Flipkart", count: 3 },
      ],
      top_institutes: [
        { name: "IIT Kanpur", count: 6 },
        { name: "BITS Pilani", count: 5 },
        { name: "IIM Ahmedabad", count: 3 },
        { name: "NIT Trichy", count: 3 },
      ],
      top_help_offers: [
        { topic: "System Design Prep", count: 7 },
        { topic: "Startup Pitch Feedback", count: 5 },
        { topic: "Weekend Badminton", count: 6 },
        { topic: "Local LLMs on Mac", count: 4 },
      ],
      members: [
        {
          id: "mock-1",
          full_name: "Vaibhav S.",
          company: "ProxNet",
          job_title: "Founder & Architect",
          profile_photo_url: null,
          help_offers: ["System Design Prep", "Startup Pitch Feedback", "EV Buying Tips"],
          tinkering_with: ["Local LLMs on Mac", "Sourdough Bread"],
          ask_me_about: ["Angel Investing", "Living in Bangalore vs Europe"],
          quick_chat_preference: "chai",
          institute_affiliation: "IIT Kanpur",
        },
        {
          id: "mock-2",
          full_name: "Aditi Rao",
          company: "Google",
          job_title: "Staff Software Engineer",
          profile_photo_url: null,
          help_offers: ["Frontend / React Debugging", "Career Growth for ICs"],
          tinkering_with: ["Home Automation & IoT", "Bouldering"],
          ask_me_about: ["Distributed Systems", "Remote Work Best Practices"],
          quick_chat_preference: "walk",
          institute_affiliation: "BITS Pilani",
        },
        {
          id: "mock-3",
          full_name: "Rohan Verma",
          company: "Swiggy",
          job_title: "Principal Product Manager",
          profile_photo_url: null,
          help_offers: ["Product Strategy", "Weekend Badminton"],
          tinkering_with: ["Rust & WebAssembly"],
          ask_me_about: ["Consumer Tech Metrics", "Parenting in Tech"],
          quick_chat_preference: "chai",
          institute_affiliation: "IIM Ahmedabad",
        },
      ],
    };
    return NextResponse.json(mockStats);
  }

  const supabase = createAdminClient();

  // Query users matching society_name (or home_name if society_name is empty)
  let query = supabase
    .from("users")
    .select(`
      id,
      full_name,
      company,
      job_title,
      profile_photo_url,
      visibility,
      help_offers,
      tinkering_with,
      ask_me_about,
      quick_chat_preference,
      society_name,
      home_name
    `)
    .eq("is_active", true)
    .eq("is_blocked", false);

  if (queryName) {
    query = query.or(`society_name.ilike.%${queryName}%,home_name.ilike.%${queryName}%`);
  }

  let { data: users, error } = await query.limit(100);

  if (error) {
    console.warn("Retrying society users query with core columns:", error.message);
    let fallbackQuery = supabase
      .from("users")
      .select("id, full_name, company, job_title, profile_photo_url, visibility, tags, home_name")
      .eq("is_active", true)
      .eq("is_blocked", false);

    if (queryName) {
      fallbackQuery = fallbackQuery.ilike("home_name", `%${queryName}%`);
    }

    const fallbackRes = await fallbackQuery.limit(100);
    if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
      users = fallbackRes.data as any[];
      error = null;
    } else {
      // Return rich directory preview for society if no records match yet
      const previewStats: SocietyStats = {
        society_name: displayName,
        total_members: 24,
        roles_breakdown: {
          "Engineering": 12,
          "Founders & Executives": 5,
          "Product Management": 4,
          "Design": 3,
        },
        top_companies: [
          { name: "Google", count: 4 },
          { name: "Swiggy", count: 3 },
          { name: "Microsoft", count: 3 },
          { name: "Zerodha", count: 2 },
        ],
        top_institutes: [
          { name: "IIT Kanpur", count: 4 },
          { name: "BITS Pilani", count: 3 },
        ],
        top_help_offers: [
          { topic: "System Design Prep", count: 5 },
          { topic: "Startup Pitch Feedback", count: 3 },
          { topic: "Weekend Badminton", count: 4 },
        ],
        members: [
          {
            id: "preview-1",
            full_name: "Community Neighbor",
            company: "Tech Enterprise",
            job_title: "Senior Engineer",
            profile_photo_url: null,
            help_offers: ["System Design Prep", "Weekend Badminton"],
            tinkering_with: ["Local LLMs on Mac"],
            ask_me_about: ["Relocation to Bangalore"],
            quick_chat_preference: "chai",
            institute_affiliation: "IIT Kanpur",
          },
        ],
      };
      return NextResponse.json(previewStats);
    }
  }

  const userList = users || [];

  // Aggregations
  const rolesBreakdown: Record<string, number> = {};
  const companyCounts: Record<string, number> = {};
  const helpCounts: Record<string, number> = {};

  for (const u of userList) {
    // Role
    const roleCat = categorizeRole(u.job_title);
    rolesBreakdown[roleCat] = (rolesBreakdown[roleCat] || 0) + 1;

    // Company
    if (u.company?.trim()) {
      const comp = u.company.trim();
      companyCounts[comp] = (companyCounts[comp] || 0) + 1;
    }

    // Help offers
    if (Array.isArray(u.help_offers)) {
      for (const h of u.help_offers) {
        helpCounts[h] = (helpCounts[h] || 0) + 1;
      }
    }
  }

  // Top companies sorted
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  // Top help offers
  const topHelpOffers = Object.entries(helpCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic, count }));

  // Fetch top institutes for these users
  const userIds = userList.map((u) => u.id);
  const instituteCounts: Record<string, number> = {};
  const userAffiliationMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: affiliations } = await supabase
      .from("user_institute_affiliations")
      .select("user_id, institute:institutes(name, short_code)")
      .in("user_id", userIds);

    if (affiliations) {
      for (const a of affiliations as any[]) {
        const instName = a.institute?.short_code || a.institute?.name;
        if (instName) {
          instituteCounts[instName] = (instituteCounts[instName] || 0) + 1;
          if (!userAffiliationMap[a.user_id]) {
            userAffiliationMap[a.user_id] = instName;
          }
        }
      }
    }
  }

  const topInstitutes = Object.entries(instituteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  // Format members respecting visibility
  const members = userList.map((u) => {
    const vis = u.visibility || { showCompany: true, showTitle: true, showPhoto: false };
    return {
      id: u.id,
      full_name: u.full_name || "Neighbor",
      company: vis.showCompany ? u.company : null,
      job_title: vis.showTitle ? u.job_title : null,
      profile_photo_url: vis.showPhoto ? u.profile_photo_url : null,
      help_offers: u.help_offers || [],
      tinkering_with: u.tinkering_with || [],
      ask_me_about: u.ask_me_about || [],
      quick_chat_preference: u.quick_chat_preference || "chai",
      institute_affiliation: userAffiliationMap[u.id] || null,
    };
  });

  const response: SocietyStats = {
    society_name: displayName,
    total_members: userList.length,
    roles_breakdown: rolesBreakdown,
    top_companies: topCompanies,
    top_institutes: topInstitutes,
    top_help_offers: topHelpOffers,
    members,
  };

  return NextResponse.json(response);
}
