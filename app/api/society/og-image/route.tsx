import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

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

  let totalMembers = 38;
  let techLeads = 14;
  let topCompanies = ["Google", "Swiggy", "Microsoft", "Zerodha", "Flipkart"];
  let topAlums = "IIT Kanpur & BITS Pilani";

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      let query = supabase
        .from("users")
        .select("id, full_name, company, job_title")
        .eq("is_active", true)
        .eq("is_blocked", false);

      if (queryName) {
        query = query.or(`society_name.ilike.%${queryName}%,home_name.ilike.%${queryName}%`);
      }

      const { data: users } = await query.limit(100);
      if (users && users.length > 0) {
        totalMembers = users.length;
        techLeads = users.filter((u) => {
          const t = (u.job_title || "").toLowerCase();
          return t.includes("founder") || t.includes("lead") || t.includes("architect") || t.includes("director") || t.includes("manager");
        }).length;

        const compMap: Record<string, number> = {};
        for (const u of users) {
          if (u.company?.trim()) {
            compMap[u.company.trim()] = (compMap[u.company.trim()] || 0) + 1;
          }
        }
        const sortedComps = Object.entries(compMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([c]) => c);
        if (sortedComps.length > 0) {
          topCompanies = sortedComps;
        }
      }
    } catch (e) {
      console.error("Failed to query dynamic OG stats:", e);
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0B0F19",
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.22) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(245, 158, 11, 0.18) 0%, transparent 45%)",
          padding: "60px 70px",
          fontFamily: "sans-serif",
          color: "#FFFFFF",
        }}
      >
        {/* Top Tag & Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.35)",
              padding: "8px 20px",
              borderRadius: "999px",
            }}
          >
            <span style={{ fontSize: "20px" }}>🏢</span>
            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#60A5FA", letterSpacing: "1px" }}>
              HYPERLOCAL TECH YEARBOOK
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "900",
                color: "#FFFFFF",
              }}
            >
              PX
            </div>
            <span style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "-0.5px" }}>ProxNet</span>
          </div>
        </div>

        {/* Center Title & Hook */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
          <div
            style={{
              fontSize: "56px",
              fontWeight: "900",
              letterSpacing: "-1.5px",
              lineHeight: "1.1",
              background: "linear-gradient(180deg, #FFFFFF 0%, #CBD5E1 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {displayName}
          </div>
          <div style={{ fontSize: "24px", color: "#94A3B8", fontWeight: "500" }}>
            Discover the engineers, founders, and creators living in your community.
          </div>
        </div>

        {/* 3 Large Stat Badges */}
        <div style={{ display: "flex", gap: "24px", marginTop: "10px" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: "42px", fontWeight: "900", color: "#60A5FA" }}>{totalMembers}+</div>
            <div style={{ fontSize: "15px", color: "#94A3B8", fontWeight: "600", marginTop: "4px" }}>
              Tech Neighbors
            </div>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: "42px", fontWeight: "900", color: "#34D399" }}>{techLeads}+</div>
            <div style={{ fontSize: "15px", color: "#94A3B8", fontWeight: "600", marginTop: "4px" }}>
              Founders & Leads
            </div>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: "32px", fontWeight: "900", color: "#FBBF24", marginTop: "6px" }}>
              {topAlums.includes("&") ? "IIT & BITS" : "Alma Mater"}
            </div>
            <div style={{ fontSize: "15px", color: "#94A3B8", fontWeight: "600", marginTop: "4px" }}>
              Top Institutes Represented
            </div>
          </div>
        </div>

        {/* Footer: Companies & CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            paddingTop: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "16px", color: "#94A3B8" }}>
            <span style={{ color: "#E2E8F0", fontWeight: "bold" }}>Companies:</span>
            <span>{topCompanies.join(" • ")}</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              padding: "12px 24px",
              borderRadius: "14px",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            <span>See who lives next door →</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
